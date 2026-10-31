"""Graph 4: Weekly Digest.

gather -> compose -> propose -> END

For every person with an email address: what is open / overdue / slipping for them, which recent
decisions touch them, and which open issues sit on their tasks. The LLM turns that into a short
email, which becomes a pending "email" proposal so it goes through the Review Queue like everything else.
"""
import asyncio
import json
import operator
import re
import uuid
from datetime import date, timedelta
from typing import Annotated, Callable, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.graphs.ingest import IngestNodes, _emit
from app.agents.llm import embed_texts, get_structured_model
from app.agents.prompts import build_digest_messages
from app.agents.review import apply_review_actions
from app.agents.schemas import DigestEmail
from app.agents.store import Store, cosine

DIGEST_RUN_PREFIX = "digest-"  # these runs have no ingest-graph checkpoint; see confirm_digest_run
RECENT_DAYS = 7
DECISION_TASK_MIN_SIM = 0.35
MAX_WORDS = 180


class DigestState(TypedDict, total=False):
    today: str
    run_id: str
    people_facts: list[dict]
    emails: list[dict]
    proposals: list[dict]
    events: Annotated[list[dict], operator.add]


def is_overdue(task: dict, today: str) -> bool:
    return bool(task.get("deadline")) and task["deadline"] < today and task["status"] != "completed"


def _mentions(text: str, person: dict) -> bool:
    return any(
        re.search(rf"\b{re.escape(name)}\b", text, re.IGNORECASE)
        for name in {person["name"], *person.get("aliases", [])}
        if name and not name.lower().startswith("speaker")
    )


def _task_fact(t: dict, today: str) -> dict:
    return {
        "title": t["title"],
        "deadline": t.get("deadline"),
        "deadline_raw": t.get("deadline_raw"),
        "status": t["status"],
        "rollover_count": t.get("rollover_count", 0),
        "overdue": is_overdue(t, today),
    }


def _trim_words(body: str, limit: int = MAX_WORDS) -> str:
    """Models miscount; drop trailing lines until the body fits."""
    lines = body.rstrip().splitlines()
    while len(" ".join(lines).split()) > limit and len(lines) > 1:
        lines.pop()
    return "\n".join(lines)


async def _embed(texts: list[str]) -> list[list[float]]:
    return await asyncio.to_thread(embed_texts, texts)


class DigestNodes:
    def __init__(self, store: Store):
        self.store = store

    async def gather(self, state: DigestState) -> dict:
        today = state["today"]
        since = (date.fromisoformat(today) - timedelta(days=RECENT_DAYS)).isoformat()
        people = [p for p in self.store.list_people() if p.get("email")]
        all_tasks = self.store.list_tasks()
        recent = [d for d in self.store.list_decisions() if since <= d["held_at"][:10] <= today]
        open_issues = self.store.get_open_issues()

        owned = {p["id"]: [t for t in all_tasks if t.get("owner_id") == p["id"]] for p in people}
        titles = [t["title"] for p in people for t in owned[p["id"]] if t["status"] != "completed"]
        vectors = iter(await _embed(titles) if titles else [])
        task_vec = {t["id"]: next(vectors) for p in people for t in owned[p["id"]] if t["status"] != "completed"}

        facts, events = [], []
        for p in people:
            tasks = owned[p["id"]]
            active = [t for t in tasks if t["status"] != "completed"]
            ids = {t["id"] for t in tasks}
            titles_lower = {t["title"].lower() for t in tasks}
            decision_ids = set()
            for d in recent:
                if d.get("made_by_id") == p["id"] or _mentions(f"{d['statement']} {d['made_by'] or ''}", p):
                    decision_ids.add(d["id"])
            for t in active:  # recent decisions about the same thing as one of their tasks
                for d in self.store.search_decisions(task_vec[t["id"]], 10):
                    if d["similarity"] >= DECISION_TASK_MIN_SIM and since <= d["held_at"][:10] <= today:
                        decision_ids.add(d["id"])
            issues = [
                i for i in open_issues
                if i.get("task_id") in ids or str(i["details"].get("task_title", "")).lower() in titles_lower
            ]
            person_facts = {
                "person": p["name"],
                "open_tasks": [_task_fact(t, today) for t in active],
                "overdue_tasks": [_task_fact(t, today) for t in active if is_overdue(t, today)],
                "slipped_tasks": [_task_fact(t, today) for t in tasks if t.get("rollover_count", 0) >= 1],
                "recent_decisions": [
                    {"date": d["held_at"][:10], "topic": d["topic"], "statement": d["statement"], "status": d["status"]}
                    for d in recent if d["id"] in decision_ids
                ],
                "open_issues": [{"type": i["type"], "title": i["title"]} for i in issues],
            }
            facts.append({"person": p, "facts": person_facts})
            events.append(_emit(
                "gather",
                f"{p['name']}: {len(active)} open, {len(person_facts['overdue_tasks'])} overdue, "
                f"{len(person_facts['slipped_tasks'])} slipped",
            ))
        return {"people_facts": facts, "events": events}

    async def compose(self, state: DigestState) -> dict:
        today = state["today"]

        async def one(entry: dict) -> dict:
            person, facts = entry["person"], entry["facts"]
            has_content = any(facts[k] for k in ("open_tasks", "slipped_tasks", "recent_decisions", "open_issues"))
            if not has_content:
                first = person["name"].split()[0]
                return {"person": person, "subject": "Your week: all clear",
                        "body": f"Hi {first},\n\n- Nothing open on your plate this week.\n\nFollowThrough"}
            messages = build_digest_messages(person["name"], today, json.dumps(facts, indent=1, ensure_ascii=False))
            email = await get_structured_model(DigestEmail).ainvoke(messages)
            return {"person": person, "subject": email.subject.strip(), "body": _trim_words(email.body)}

        emails = await asyncio.gather(*(one(e) for e in state["people_facts"]))
        return {"emails": list(emails), "events": [_emit("compose", f"Drafted {len(emails)} emails")]}

    def propose(self, state: DigestState) -> dict:
        proposals = self.store.save_proposals(None, state["run_id"], [
            {"kind": "email", "payload": {
                "to": e["person"]["email"], "to_name": e["person"]["name"],
                "subject": e["subject"], "body": e["body"],
            }}
            for e in state["emails"]
        ])
        return {"proposals": proposals, "events": [_emit(
            "propose", f"{len(proposals)} email proposals waiting in the Review Queue",
            {"proposal_ids": [p["id"] for p in proposals]},
        )]}


def build_digest_graph(store: Store):
    nodes = DigestNodes(store)
    g = StateGraph(DigestState)
    g.add_node("gather", nodes.gather)
    g.add_node("compose", nodes.compose)
    g.add_node("propose", nodes.propose)
    g.add_edge(START, "gather")
    g.add_edge("gather", "compose")
    g.add_edge("compose", "propose")
    g.add_edge("propose", END)
    return g.compile()


async def run_digest(
    store: Store, today: str | None = None, on_event: Callable[[dict], None] | None = None
) -> dict:
    """-> {"run_id", "proposals": [pending email proposals]}. `today` (yyyy-mm-dd) defaults to the real today."""
    state = {"today": today or date.today().isoformat(), "run_id": f"{DIGEST_RUN_PREFIX}{uuid.uuid4()}"}
    final: dict = {}
    async for mode, chunk in build_digest_graph(store).astream(state, stream_mode=["custom", "values"]):
        if mode == "custom":
            if on_event:
                on_event({"type": "event", **chunk})
        else:
            final = chunk
    return {"run_id": state["run_id"], "proposals": final["proposals"]}


async def confirm_digest_run(store: Store, executor, run_id: str, actions: list[dict]) -> None:
    """Review + send for a digest run. There is no paused graph to resume, so apply the actions
    and execute the approved proposals directly (same executor path as the ingest graph)."""
    pending = store.get_proposals(run_id, "pending")
    apply_review_actions(store, pending, actions, store.list_people())
    await IngestNodes(store, executor).execute({"run_id": run_id})
