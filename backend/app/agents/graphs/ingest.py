"""Graph 1: Ingest & Analyze.

load_transcript -> extract -> resolve_dates -> embed_and_save_decisions
-> detect_conflicts -> match_open_tasks -> save_new_tasks -> detect_gaps
-> build_proposals -> END

Every node returns an event and also streams it via the LangGraph custom stream.
"""
import asyncio
import operator
import re
from datetime import datetime
from pathlib import Path
from typing import Annotated, Any, TypedDict

import dateparser
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from app.agents.conflicts import classify_many, is_conflict
from app.agents.extract import extract_meeting
from app.agents.llm import embed_texts
from app.agents.schemas import Extraction, TaskUpdateMatch
from app.agents.store import Store, cosine, match_person
from app.agents.task_matching import find_duplicate_new_item, match_many

CONFLICT_CANDIDATE_MIN_SIM = 0.35
DISAGREEMENT_RESOLVE_SIM = 0.5
BATCH_DUPLICATE_SIM = 0.8
MATCH_K = 5


class IngestState(TypedDict, total=False):
    run_id: str
    meeting_id: Any
    meeting: dict
    people: list[dict]
    transcript: str
    extraction: dict
    new_decisions: list[dict]
    new_task_items: list[dict]
    saved_tasks: list[dict]
    task_updates: list[dict]
    issues: Annotated[list[dict], operator.add]
    proposals: list[dict]
    events: Annotated[list[dict], operator.add]
    use_cache: bool
    cache_path: str | None


# ---- helpers -----------------------------------------------------------

def _emit(node: str, message: str, data: dict | None = None) -> dict:
    event = {"node": node, "status": "done", "message": message, "data": data or {}}
    get_stream_writer()(event)
    return event


async def _embed(texts: list[str]) -> list[list[float]]:
    return await asyncio.to_thread(embed_texts, texts)


def _held_at(meeting: dict) -> datetime:
    return datetime.fromisoformat(meeting["held_at"]).replace(tzinfo=None)


def _ordinal(n: int) -> str:
    return {1: "1st", 2: "2nd", 3: "3rd"}.get(n, f"{n}th")


def _clean_deadline(raw: str) -> str:
    """Drop a leading 'by' and a weekday that precedes an explicit date ('Friday, October 24')."""
    text = re.sub(r"^\s*by\s+", "", raw, flags=re.IGNORECASE)
    return re.sub(r"^[A-Za-z]+day,?\s+(?=[A-Za-z]+\s+\d)", "", text)


def resolve_deadline(raw: str | None, confidence: str, base: datetime) -> str | None:
    """ISO date for a spoken deadline, relative to the meeting date. Vague/none -> None."""
    if not raw or confidence in ("vague", "none"):
        return None
    text = _clean_deadline(raw)
    parsed = dateparser.parse(
        text, settings={"RELATIVE_BASE": base, "PREFER_DATES_FROM": "future"}
    )
    return parsed.date().isoformat() if parsed else None


def _decision_view(d: dict, title: str, date: str) -> dict:
    return {
        "id": d.get("id"),
        "meeting_title": title,
        "meeting_date": date,
        "topic": d["topic"],
        "statement": d["statement"],
        "made_by": d.get("made_by"),
        "source_quote": d["source_quote"],
    }


# ---- nodes -------------------------------------------------------------

class IngestNodes:
    def __init__(self, store: Store):
        self.store = store

    def load_transcript(self, state: IngestState) -> dict:
        meeting_id = state["meeting_id"]
        meeting = self.store.get_meeting(meeting_id)
        segments = self.store.get_segments(meeting_id)
        transcript = "\n".join(f"{s['speaker']}: {s['text']}" for s in segments)
        event = _emit(
            "load_transcript",
            f"Loaded '{meeting['title']}' — {len(segments)} lines",
            {"lines": len(segments)},
        )
        return {
            "meeting": meeting,
            "people": self.store.list_people(),
            "transcript": transcript,
            "events": [event],
        }

    async def extract(self, state: IngestState) -> dict:
        extraction = await self._get_extraction(state)
        data = extraction.model_dump()
        event = _emit(
            "extract",
            f"Extracted {len(data['decisions'])} decisions, {len(data['action_items'])} action items, "
            f"{len(data['disagreements'])} disagreements",
            {"cached": self._use_cache(state)},
        )
        return {
            "extraction": data,
            "new_decisions": data["decisions"],
            "new_task_items": data["action_items"],
            "events": [event],
        }

    @staticmethod
    def _use_cache(state: IngestState) -> bool:
        path = state.get("cache_path")
        return bool(state.get("use_cache") and path and Path(path).exists())

    async def _get_extraction(self, state: IngestState) -> Extraction:
        if self._use_cache(state):
            return Extraction.model_validate_json(Path(state["cache_path"]).read_text(encoding="utf-8"))
        meeting = state["meeting"]
        people = [{"name": p["name"], "aliases": p.get("aliases", [])} for p in state["people"]]
        return await asyncio.to_thread(
            extract_meeting, state["transcript"], meeting["title"], meeting["held_at"][:10], people
        )

    def resolve_dates(self, state: IngestState) -> dict:
        base = _held_at(state["meeting"])
        items = [
            {**a, "deadline": resolve_deadline(a["deadline_raw"], a["deadline_confidence"], base)}
            for a in state["new_task_items"]
        ]
        dated = sum(i["deadline"] is not None for i in items)
        event = _emit(
            "resolve_dates",
            f"Resolved {dated} of {len(items)} deadlines to calendar dates",
            {"resolved": dated, "total": len(items)},
        )
        return {"new_task_items": items, "events": [event]}

    async def embed_and_save_decisions(self, state: IngestState) -> dict:
        decisions = state["new_decisions"]
        rows: list[dict] = []
        if decisions:
            vectors = await _embed([f"{d['topic']}: {d['statement']}" for d in decisions])
            to_save = [
                {**d, "made_by_id": self._person_id(d.get("made_by"), state), "embedding": v}
                for d, v in zip(decisions, vectors)
            ]
            rows = self.store.save_decisions(state["meeting_id"], to_save)
        event = _emit("embed_and_save_decisions", f"Saved {len(rows)} decisions", {"count": len(rows)})
        return {"new_decisions": rows, "events": [event]}

    @staticmethod
    def _person_id(name: str | None, state: IngestState):
        person = match_person(name, state["people"])
        return person["id"] if person else None

    # -- conflicts --

    async def detect_conflicts(self, state: IngestState) -> dict:
        candidates = self._conflict_candidates(state)
        verdicts = await classify_many([(new, past) for _, new, _, past in candidates])
        issues = [
            self._save_conflict(state, new_row, new, past_row, past, verdict)
            for (new_row, new, past_row, past), verdict in zip(candidates, verdicts)
            if is_conflict(verdict)
        ]
        events = [
            _emit(
                "detect_conflicts",
                f"Checked {len(candidates)} past decisions → {len(issues)} conflicts found",
                {"checked": len(candidates), "conflicts": len(issues)},
            )
        ]
        events += await self._resolve_disagreements(state)
        return {"issues": issues, "events": events}

    def _conflict_candidates(self, state: IngestState) -> list[tuple]:
        """(new_row, new_view, past_row, past_view) for each similar past decision."""
        meeting = state["meeting"]
        found = []
        for row in state["new_decisions"]:
            new_view = _decision_view(row, meeting["title"], meeting["held_at"][:10])
            matches = self.store.match_decisions(row["embedding"], MATCH_K, state["meeting_id"])
            for past in matches:
                if past["similarity"] < CONFLICT_CANDIDATE_MIN_SIM:
                    continue
                past_view = _decision_view(past, past["meeting_title"], past["meeting_date"])
                found.append((row, new_view, past, past_view))
        return found

    def _save_conflict(self, state, new_row, new, past_row, past, verdict) -> dict:
        return self.store.save_issue({
            "type": "conflict",
            "title": verdict.explanation,
            "details": {
                "new": new,
                "past": past,
                "relation": verdict.relation,
                "explanation": verdict.explanation,
                "confidence": verdict.confidence,
            },
            "decision_id": new_row["id"],
            "related_decision_id": past_row["id"],
            "meeting_id": state["meeting_id"],
        })

    async def _resolve_disagreements(self, state: IngestState) -> list[dict]:
        """Close open disagreements from earlier meetings that a new decision settles."""
        earlier = [
            i for i in self.store.get_open_issues("disagreement")
            if i.get("meeting_id") != state["meeting_id"]
        ]
        if not earlier or not state["new_decisions"]:
            return []
        topic_vectors = await _embed([i["details"]["topic"] for i in earlier])
        events = []
        for issue, vec in zip(earlier, topic_vectors):
            best = max(state["new_decisions"], key=lambda d: cosine(vec, d["embedding"]))
            if cosine(vec, best["embedding"]) < DISAGREEMENT_RESOLVE_SIM:
                continue
            self.store.update_issue(
                issue["id"], {"status": "resolved", "resolved_by_decision_id": best["id"]}
            )
            events.append(_emit(
                "detect_conflicts",
                f"Disagreement on '{issue['details']['topic']}' resolved: {best['statement']}",
                {"issue_id": issue["id"], "decision_id": best["id"]},
            ))
        return events

    # -- open tasks --

    async def match_open_tasks(self, state: IngestState) -> dict:
        meeting_id = state["meeting_id"]
        open_tasks = self.store.get_open_tasks(meeting_id)
        items = state["new_task_items"]
        if not open_tasks:
            event = _emit("match_open_tasks", "No open tasks from earlier meetings")
            return {"task_updates": [], "events": [event]}

        results = await match_many(open_tasks, state["transcript"], items)
        base = _held_at(state["meeting"])
        updates, events, dropped = [], [], set()
        for task, result in zip(open_tasks, results):
            if result.update == "not_mentioned":
                continue
            record, message, dup_idx = await self._apply_update(task, result, items, base)
            self.store.save_task_update(task["id"], meeting_id, result.update, result.quote)
            updates.append(record)
            events.append(_emit("match_open_tasks", message, record))
            if dup_idx is not None:
                dropped.add(dup_idx)

        remaining = [it for i, it in enumerate(items) if i not in dropped]
        summary = _emit(
            "match_open_tasks",
            f"Checked {len(open_tasks)} open tasks → {len(updates)} updated, "
            f"{len(dropped)} duplicate new items dropped",
            {"open": len(open_tasks), "updated": len(updates), "dropped": len(dropped)},
        )
        return {
            "task_updates": updates,
            "new_task_items": remaining,
            "events": [summary, *events],
        }

    async def _apply_update(self, task: dict, result: TaskUpdateMatch, items: list[dict], base: datetime):
        """Apply one task update to the store -> (record, message, duplicate new-item index)."""
        record = {
            "task_id": task["id"],
            "title": task["title"],
            "owner": task.get("owner"),
            "update": result.update,
            "quote": result.quote,
            "new_deadline_raw": None,
            "deadline_confidence": None,
            "rollover_count": task.get("rollover_count", 0),
        }
        if result.update == "recommitted":
            return await self._recommit(task, result, items, base, record)
        if result.update == "completed":
            self.store.update_task(task["id"], {"status": "completed"})
            self._close_task_issues(task["id"])
            return record, f"'{task['title']}' marked completed", None
        self.store.update_task(task["id"], {"status": result.update})
        return record, f"'{task['title']}' is {result.update.replace('_', ' ')}", None

    def _close_task_issues(self, task_id) -> None:
        for issue in self.store.get_open_issues():
            if issue.get("task_id") == task_id:
                self.store.update_issue(issue["id"], {"status": "resolved"})

    async def _recommit(self, task, result, items, base, record):
        idx = await asyncio.to_thread(find_duplicate_new_item, task, items)
        item = items[idx] if idx is not None else {}
        raw = result.new_deadline_raw or item.get("deadline_raw")
        if item:
            confidence, deadline = item["deadline_confidence"], item["deadline"]
        else:
            deadline = resolve_deadline(raw, "inferred", base)
            confidence = "inferred" if deadline else "vague"
        count = task.get("rollover_count", 0) + 1
        fields = {"status": "open", "rollover_count": count}
        if raw:
            fields.update(deadline_raw=raw, deadline=deadline, deadline_confidence=confidence)
        self.store.update_task(task["id"], fields)
        record.update(new_deadline_raw=raw, deadline_confidence=confidence, rollover_count=count)
        new_date = _clean_deadline(raw) if raw else "a new date"
        when = f"again ({_ordinal(count)} time)" if count > 1 else f"to {new_date}"
        return record, f"'{task['title']}' pushed back {when}", idx

    async def save_new_tasks(self, state: IngestState) -> dict:
        items, vectors = await self._unique_items(state["new_task_items"])
        rows = [self._task_row(it, v, state) for it, v in zip(items, vectors)]
        saved = self.store.save_tasks(state["meeting_id"], rows) if rows else []
        event = _emit("save_new_tasks", f"Saved {len(saved)} new tasks", {"count": len(saved)})
        return {"saved_tasks": saved, "events": [event]}

    async def _unique_items(self, items: list[dict]) -> tuple[list[dict], list[list[float]]]:
        """Embed titles and drop near-identical items from the same owner within the meeting."""
        if not items:
            return [], []
        vectors = await _embed([it["title"] for it in items])
        kept: list[tuple[dict, list[float]]] = []
        for it, vec in zip(items, vectors):
            same = any(
                (k["owner"] or "").lower() == (it["owner"] or "").lower()
                and cosine(vec, kv) >= BATCH_DUPLICATE_SIM
                for k, kv in kept
            )
            if not same:
                kept.append((it, vec))
        return [k for k, _ in kept], [v for _, v in kept]

    def _task_row(self, item: dict, vector: list[float], state: IngestState) -> dict:
        return {
            "title": item["title"],
            "owner": item["owner"],
            "owner_id": self._person_id(item["owner"], state),
            "deadline_raw": item["deadline_raw"],
            "deadline": item["deadline"],
            "deadline_confidence": item["deadline_confidence"],
            "source_quote": item["source_quote"],
            "embedding": vector,
        }

    # -- gaps --

    def detect_gaps(self, state: IngestState) -> dict:
        mid = state["meeting_id"]
        issues = (
            self._vague_deadline_issues(state)
            + self._missing_owner_issues(state)
            + self._disagreement_issues(state)
        )
        saved = [self.store.save_issue({**i, "meeting_id": mid}) for i in issues]
        counts = {t: sum(i["type"] == t for i in saved) for t in
                  ("vague_deadline", "missing_owner", "disagreement")}
        event = _emit(
            "detect_gaps",
            f"Found {counts['vague_deadline']} vague deadlines, {counts['missing_owner']} unowned tasks, "
            f"{counts['disagreement']} open disagreements",
            counts,
        )
        return {"issues": saved, "events": [event]}

    def _vague_deadline_issues(self, state: IngestState) -> list[dict]:
        new = [
            (t["id"], t["title"], t["owner"], t["deadline_raw"])
            for t in state["saved_tasks"] if t["deadline_confidence"] == "vague"
        ]
        already = {i.get("task_id") for i in self.store.get_open_issues("vague_deadline")}
        recommitted = [
            (u["task_id"], u["title"], u["owner"], u["new_deadline_raw"])
            for u in state.get("task_updates", [])
            if u["update"] == "recommitted"
            and u["deadline_confidence"] == "vague"
            and u["task_id"] not in already
        ]
        return [
            {
                "type": "vague_deadline",
                "title": f"No firm date for '{title}'",
                "details": {"task_title": title, "owner": owner, "deadline_raw": raw},
                "task_id": task_id,
            }
            for task_id, title, owner, raw in new + recommitted
        ]

    @staticmethod
    def _missing_owner_issues(state: IngestState) -> list[dict]:
        return [
            {
                "type": "missing_owner",
                "title": f"Nobody owns '{t['title']}'",
                "details": {"task_title": t["title"], "deadline_raw": t["deadline_raw"]},
                "task_id": t["id"],
            }
            for t in state["saved_tasks"] if not t["owner"]
        ]

    @staticmethod
    def _disagreement_issues(state: IngestState) -> list[dict]:
        return [
            {
                "type": "disagreement",
                "title": f"Unresolved disagreement: {d['topic']}",
                "details": {
                    "topic": d["topic"],
                    "positions": d["positions"],
                    "source_quote": d["source_quote"],
                },
            }
            for d in state["extraction"]["disagreements"] if not d["resolved"]
        ]

    # -- proposals --

    def build_proposals(self, state: IngestState) -> dict:
        issues = state.get("issues", [])
        proposals = (
            [self._notion_task(t) for t in state["saved_tasks"] if t["owner"]]
            + [self._gap_message(i) for i in issues if i["type"] in ("missing_owner", "vague_deadline")]
            + [self._summary_message(state, issues)]
        )
        saved = self.store.save_proposals(state["meeting_id"], state["run_id"], proposals)
        event = _emit("build_proposals", f"Prepared {len(saved)} proposals for review", {"count": len(saved)})
        # TODO: human_review interrupt node goes here (approve/reject/edit proposals) before END.
        return {"proposals": saved, "events": [event]}

    @staticmethod
    def _notion_task(task: dict) -> dict:
        return {
            "kind": "notion_task",
            "task_id": task["id"],
            "payload": {
                "title": task["title"],
                "owner": task["owner"],
                "owner_id": task["owner_id"],
                "deadline": task["deadline"],
                "deadline_raw": task["deadline_raw"],
                "source_quote": task["source_quote"],
            },
        }

    @staticmethod
    def _gap_message(issue: dict) -> dict:
        title = issue["details"]["task_title"]
        owner = issue["details"].get("owner")
        if issue["type"] == "missing_owner":
            text = f"Nobody owns '{title}' yet — who can take it?"
        elif owner:
            text = f"@{owner}, can you confirm a date for '{title}'?"
        else:
            text = f"Can someone confirm a date for '{title}'?"
        return {
            "kind": "slack_message",
            "issue_id": issue["id"],
            "payload": {"channel": "team", "text": text},
        }

    @staticmethod
    def _summary_message(state: IngestState, issues: list[dict]) -> dict:
        meeting = state["meeting"]
        conflicts = [i for i in issues if i["type"] == "conflict"]
        lines = [f"Summary of '{meeting['title']}' ({meeting['held_at'][:10]}):"]
        if conflicts:
            lines.append("Conflicts with earlier decisions:")
            lines += [f"• {c['details']['explanation']}" for c in conflicts]
        else:
            lines.append("No conflicts with earlier decisions.")
        return {
            "kind": "slack_message",
            "payload": {"channel": "team", "text": "\n".join(lines)},
        }


NODE_ORDER = [
    "load_transcript",
    "extract",
    "resolve_dates",
    "embed_and_save_decisions",
    "detect_conflicts",
    "match_open_tasks",
    "save_new_tasks",
    "detect_gaps",
    "build_proposals",
]


def build_ingest_graph(store: Store, checkpointer=None):
    nodes = IngestNodes(store)
    graph = StateGraph(IngestState)
    for name in NODE_ORDER:
        graph.add_node(name, getattr(nodes, name))
    graph.add_edge(START, NODE_ORDER[0])
    for a, b in zip(NODE_ORDER, NODE_ORDER[1:]):
        graph.add_edge(a, b)
    graph.add_edge(NODE_ORDER[-1], END)
    return graph.compile(checkpointer=checkpointer)
