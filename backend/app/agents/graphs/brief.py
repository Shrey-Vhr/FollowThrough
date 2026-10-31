"""Graph 3: Pre-meeting Brief.

split_topics -> retrieve -> compose -> save -> END

Takes a free-text agenda (usually dictated), pulls what the team already decided / promised / left open
about each topic, and writes a one-page brief. Read-only except for the final save_brief.
Every node returns an event and also streams it via the LangGraph custom stream.
"""
import asyncio
import json
import operator
from typing import Annotated, Any, AsyncIterator, Callable, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.graphs.ingest import _emit
from app.agents.llm import embed_texts, get_structured_model
from app.agents.prompts import build_agenda_messages, build_brief_messages
from app.agents.schemas import AgendaTopics, BriefOut
from app.agents.store import Store, cosine

SEARCH_K = 6
DECISION_TASK_MIN_SIM = 0.3
ISSUE_MIN_SIM = 0.35
MAX_TOPICS = 5
MAX_QUESTIONS = 3
BRIEF_ISSUE_TYPES = ("conflict", "disagreement", "vague_deadline", "missing_owner")


class BriefState(TypedDict, total=False):
    agenda: str
    meeting_at: str | None
    topics: list[str]
    facts: list[dict]
    brief: dict
    saved: dict
    events: Annotated[list[dict], operator.add]


async def _embed(texts: list[str]) -> list[list[float]]:
    return await asyncio.to_thread(embed_texts, texts)


def _issue_text(issue: dict) -> str:
    d = issue["details"]
    if issue["type"] == "conflict":
        return f"{issue['title']} {d['new']['statement']} {d['past']['statement']}"
    if issue["type"] == "disagreement":
        views = " ".join(f"{p['person']}: {p['view']}" for p in d.get("positions", []))
        return f"{d['topic']} {views}"
    return f"{d.get('task_title', '')} {d.get('deadline_raw') or ''}".strip()


def _issue_fact(issue: dict) -> dict:
    d = issue["details"]
    if issue["type"] == "conflict":
        return {
            "type": "conflict",
            "summary": issue["title"],
            "newer": {"date": d["new"]["meeting_date"], "statement": d["new"]["statement"]},
            "older": {"date": d["past"]["meeting_date"], "statement": d["past"]["statement"]},
        }
    return {"type": issue["type"], **{k: v for k, v in d.items() if k != "source_quote"}}


def _decision_fact(d: dict) -> dict:
    return {
        "date": d["held_at"][:10],
        "meeting_title": d["meeting_title"],
        "topic": d["topic"],
        "statement": d["statement"],
        "made_by": d.get("made_by"),
        "status": d["status"],
    }


def _task_fact(t: dict) -> dict:
    return {
        "title": t["title"],
        "owner": t.get("owner_name"),
        "deadline": t.get("deadline"),
        "deadline_raw": t.get("deadline_raw"),
        "deadline_confidence": t.get("deadline_confidence"),
        "status": t["status"],
        "rollover_count": t.get("rollover_count", 0),
        "meeting_title": t["meeting_title"],
    }


def decision_groups(decisions: list[dict], conflicts: list[dict]) -> list[list[dict]]:
    """Connected components of decisions: linked by a conflict issue, or by the same topic label.
    `decisions` must be ordered oldest -> newest; each group keeps that order and groups are
    ordered by their oldest decision."""
    parent = {d["id"]: d["id"] for d in decisions}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        if a in parent and b in parent:
            parent[find(a)] = find(b)

    by_topic: dict[str, Any] = {}
    for d in decisions:
        key = d["topic"].strip().lower()
        if key in by_topic:
            union(d["id"], by_topic[key])
        by_topic.setdefault(key, d["id"])
    for c in conflicts:
        union(c.get("decision_id"), c.get("related_decision_id"))

    groups: dict[Any, list[dict]] = {}
    for d in decisions:
        groups.setdefault(find(d["id"]), []).append(d)
    return sorted(groups.values(), key=lambda g: (g[0]["held_at"], g[0]["id"]))


class BriefNodes:
    def __init__(self, store: Store):
        self.store = store

    async def split_topics(self, state: BriefState) -> dict:
        result = await get_structured_model(AgendaTopics).ainvoke(build_agenda_messages(state["agenda"]))
        topics = [t.strip() for t in result.topics if t.strip()][:MAX_TOPICS]
        if not topics:
            topics = [state["agenda"].strip()]
        return {"topics": topics, "events": [_emit("split_topics", f"Topics: {', '.join(topics)}", {"topics": topics})]}

    async def retrieve(self, state: BriefState) -> dict:
        topics = state["topics"]
        issues = [i for t in BRIEF_ISSUE_TYPES for i in self.store.get_open_issues(t)]
        vectors = await _embed(topics + [_issue_text(i) for i in issues])
        topic_vecs, issue_vecs = vectors[: len(topics)], vectors[len(topics):]

        decisions = self.store.list_decisions()
        groups = decision_groups(decisions, self.store.list_issues(issue_type="conflict"))
        group_of = {d["id"]: g for g in groups for d in g}

        facts, events = [], []
        for topic, vec in zip(topics, topic_vecs):
            hits = [
                d for d in self.store.search_decisions(vec, SEARCH_K) if d["similarity"] >= DECISION_TASK_MIN_SIM
            ]
            ids = {m["id"] for d in hits for m in group_of.get(d["id"], [d])}  # whole chain, not just the hit
            matched = [d for d in decisions if d["id"] in ids]
            tasks = [t for t in self.store.search_tasks(vec, SEARCH_K) if t["similarity"] >= DECISION_TASK_MIN_SIM]
            topic_issues = [i for i, iv in zip(issues, issue_vecs) if cosine(vec, iv) >= ISSUE_MIN_SIM]
            facts.append({
                "topic": topic,
                "decisions": [_decision_fact(d) for d in matched],
                "tasks": [_task_fact(t) for t in tasks],
                "open_issues": [_issue_fact(i) for i in topic_issues],
            })
            events.append(_emit(
                "retrieve",
                f"'{topic}': {len(matched)} decisions, {len(tasks)} tasks, {len(topic_issues)} open issues",
                {"topic": topic},
            ))
        return {"facts": facts, "events": events}

    async def compose(self, state: BriefState) -> dict:
        facts = json.dumps(state["facts"], indent=1, ensure_ascii=False)
        messages = build_brief_messages(state["agenda"], state.get("meeting_at"), facts)
        out = (await get_structured_model(BriefOut).ainvoke(messages)).model_dump()
        for topic in out["topics"]:
            topic["history"].sort(key=lambda h: h["date"])  # oldest -> newest, whatever the model did
            topic["suggested_questions"] = topic["suggested_questions"][:MAX_QUESTIONS]
        return {"brief": out, "events": [_emit("compose", out["headline"])]}

    def save(self, state: BriefState) -> dict:
        saved = self.store.save_brief({
            "agenda": state["agenda"],
            "meeting_at": state.get("meeting_at"),
            **state["brief"],
        })
        return {"saved": saved, "events": [_emit("save", f"Brief #{saved['id']} saved", {"brief_id": saved["id"]})]}


def build_brief_graph(store: Store):
    nodes = BriefNodes(store)
    g = StateGraph(BriefState)
    g.add_node("split_topics", nodes.split_topics)
    g.add_node("retrieve", nodes.retrieve)
    g.add_node("compose", nodes.compose)
    g.add_node("save", nodes.save)
    g.add_edge(START, "split_topics")
    g.add_edge("split_topics", "retrieve")
    g.add_edge("retrieve", "compose")
    g.add_edge("compose", "save")
    g.add_edge("save", END)
    return g.compile()


async def run_brief_stream(
    store: Store, agenda: str, meeting_at: str | None = None
) -> AsyncIterator[dict]:
    """Yields {"type": "event", ...} per node, then {"type": "done", "brief": saved_brief}."""
    graph = build_brief_graph(store)
    final: dict = {}
    async for mode, chunk in graph.astream(
        {"agenda": agenda, "meeting_at": meeting_at}, stream_mode=["custom", "values"]
    ):
        if mode == "custom":
            yield {"type": "event", **chunk}
        else:
            final = chunk
    yield {"type": "done", "brief": final["saved"]}


async def run_brief(
    store: Store, agenda: str, meeting_at: str | None = None, on_event: Callable[[dict], None] | None = None
) -> dict:
    brief: dict = {}
    async for item in run_brief_stream(store, agenda, meeting_at):
        if item["type"] == "event":
            if on_event:
                on_event(item)
        else:
            brief = item["brief"]
    return brief
