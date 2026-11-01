"""Storage interface for the agent graphs, plus an in-memory implementation.

The graphs only talk to `Store`; Supabase and the in-memory store both implement it.
See STORE_CONTRACT.md for the argument/return shapes and table mapping.
"""
import re
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

import numpy as np

from app.agents.extract import DEFAULT_PEOPLE


class Store(Protocol):
    def get_meeting(self, meeting_id) -> dict: ...
    def get_segments(self, meeting_id) -> list[dict]: ...
    def list_people(self) -> list[dict]: ...
    def save_decisions(self, meeting_id, decisions: list[dict]) -> list[dict]: ...
    def save_tasks(self, meeting_id, tasks: list[dict]) -> list[dict]: ...
    def get_open_tasks(self, exclude_meeting_id) -> list[dict]: ...
    def update_task(self, task_id, fields: dict) -> None: ...
    def save_task_update(self, task_id, meeting_id, update_type: str, quote: str | None) -> None: ...
    def match_decisions(self, embedding: list[float], k: int, exclude_meeting_id) -> list[dict]: ...
    def get_open_issues(self, issue_type: str | None = None) -> list[dict]: ...
    def save_issue(self, issue: dict) -> dict: ...
    def update_issue(self, issue_id, fields: dict) -> None: ...
    def save_proposals(self, meeting_id, run_id, proposals: list[dict]) -> list[dict]: ...
    def get_proposals(self, run_id: str | None = None, status: str | None = None) -> list[dict]: ...
    def update_proposal(self, proposal_id: int, fields: dict) -> None: ...
    # ---- insights (briefs, digest, ledger) ----
    def list_decisions(self, topic: str | None = None) -> list[dict]: ...
    def list_tasks(self, owner_id=None, status: str | None = None) -> list[dict]: ...
    def list_task_updates(self, task_id=None) -> list[dict]: ...
    def list_issues(self, status: str | None = None, issue_type: str | None = None) -> list[dict]: ...
    def search_decisions(self, embedding: list[float], k: int) -> list[dict]: ...
    def search_tasks(self, embedding: list[float], k: int) -> list[dict]: ...
    def save_brief(self, brief: dict) -> dict: ...
    def get_brief(self, brief_id) -> dict: ...
    def list_briefs(self) -> list[dict]: ...


_SPEAKER_SUFFIX = re.compile(r"\s*\(.*?\)\s*$")


def normalize_speaker(label: str) -> str:
    """'Shrey Vohra (You)' -> 'shrey vohra'."""
    return _SPEAKER_SUFFIX.sub("", label).strip().lower()


def match_person(label: str | None, people: list[dict]) -> dict | None:
    """Map a speaker label or owner name to a person via name/aliases."""
    if not label:
        return None
    key = normalize_speaker(label)
    for p in people:
        if key in {normalize_speaker(a) for a in [p["name"], *p.get("aliases", [])]}:
            return p
    return None


def cosine(a, b) -> float:
    a, b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(a @ b / denom) if denom else 0.0


class InMemoryStore:
    def __init__(self, people: list[dict] | None = None):
        self.meetings: dict[int, dict] = {}
        self.segments: list[dict] = []
        self.people: list[dict] = []
        self.decisions: dict[int, dict] = {}
        self.tasks: dict[int, dict] = {}
        self.task_updates: list[dict] = []
        self.issues: dict[int, dict] = {}
        self.proposals: list[dict] = []
        self.briefs: dict[int, dict] = {}
        self._ids: dict[str, int] = {}
        for p in people or DEFAULT_PEOPLE:
            self.people.append({"id": self._next("people"), **deepcopy(p)})

    def _next(self, table: str) -> int:
        self._ids[table] = self._ids.get(table, 0) + 1
        return self._ids[table]

    # ---- seeding -------------------------------------------------------
    def load_seed_meeting(self, path, title: str, held_at: str) -> int:
        meeting_id = self._next("meetings")
        self.meetings[meeting_id] = {"id": meeting_id, "title": title, "held_at": held_at}
        lines = Path(path).read_text(encoding="utf-8").splitlines()
        for line in lines:
            line = line.strip()
            if not line or (line.startswith("<<<") and line.endswith(">>>")):
                continue
            speaker, sep, text = line.partition(":")
            if not sep:
                continue
            person = match_person(speaker, self.people)
            self.segments.append({
                "id": self._next("segments"),
                "meeting_id": meeting_id,
                "speaker": speaker.strip(),
                "person_id": person["id"] if person else None,
                "text": text.strip(),
            })
        return meeting_id

    # ---- meetings / people ---------------------------------------------
    def get_meeting(self, meeting_id) -> dict:
        return deepcopy(self.meetings[meeting_id])

    def get_segments(self, meeting_id) -> list[dict]:
        return [
            {k: s[k] for k in ("speaker", "person_id", "text")}
            for s in self.segments
            if s["meeting_id"] == meeting_id
        ]

    def list_people(self) -> list[dict]:
        return deepcopy(self.people)

    # ---- decisions -----------------------------------------------------
    def save_decisions(self, meeting_id, decisions: list[dict]) -> list[dict]:
        rows = []
        for d in decisions:
            row = {**d, "id": self._next("decisions"), "meeting_id": meeting_id}
            self.decisions[row["id"]] = row
            rows.append(deepcopy(row))
        return rows

    def match_decisions(self, embedding, k, exclude_meeting_id) -> list[dict]:
        scored = []
        for d in self.decisions.values():
            if d["meeting_id"] == exclude_meeting_id or d.get("embedding") is None:
                continue
            meeting = self.meetings[d["meeting_id"]]
            row = {key: val for key, val in d.items() if key != "embedding"}
            row.update(
                similarity=cosine(embedding, d["embedding"]),
                meeting_title=meeting["title"],
                meeting_date=meeting["held_at"][:10],
            )
            scored.append(row)
        return sorted(scored, key=lambda r: r["similarity"], reverse=True)[:k]

    # ---- tasks ---------------------------------------------------------
    def save_tasks(self, meeting_id, tasks: list[dict]) -> list[dict]:
        rows = []
        for t in tasks:
            row = {
                "status": "open",
                "rollover_count": 0,
                **t,
                "id": self._next("tasks"),
                "meeting_id": meeting_id,
            }
            self.tasks[row["id"]] = row
            rows.append(deepcopy(row))
        return rows

    def get_open_tasks(self, exclude_meeting_id) -> list[dict]:
        rows = []
        for t in self.tasks.values():
            if t["meeting_id"] == exclude_meeting_id or t["status"] == "completed":
                continue
            meeting = self.meetings[t["meeting_id"]]
            row = {k: v for k, v in t.items() if k != "embedding"}
            row.update(meeting_title=meeting["title"], meeting_date=meeting["held_at"][:10])
            rows.append(deepcopy(row))
        return rows

    def update_task(self, task_id, fields: dict) -> None:
        self.tasks[task_id].update(fields)

    def save_task_update(self, task_id, meeting_id, update_type, quote) -> None:
        self.task_updates.append({
            "id": self._next("task_updates"),
            "task_id": task_id,
            "meeting_id": meeting_id,
            "update_type": update_type,
            "quote": quote,
        })

    # ---- issues --------------------------------------------------------
    def get_open_issues(self, issue_type: str | None = None) -> list[dict]:
        return [
            deepcopy(i)
            for i in self.issues.values()
            if i["status"] == "open" and (issue_type is None or i["type"] == issue_type)
        ]

    def save_issue(self, issue: dict) -> dict:
        row = {"status": "open", **issue, "id": self._next("issues")}
        self.issues[row["id"]] = row
        return deepcopy(row)

    def update_issue(self, issue_id, fields: dict) -> None:
        self.issues[issue_id].update(fields)

    # ---- proposals -----------------------------------------------------
    def save_proposals(self, meeting_id, run_id, proposals: list[dict]) -> list[dict]:
        rows = []
        for p in proposals:
            row: dict[str, Any] = {
                "status": "pending",
                **p,
                "id": self._next("proposals"),
                "meeting_id": meeting_id,
                "run_id": run_id,
            }
            self.proposals.append(row)
            rows.append(deepcopy(row))
        return rows

    def get_proposals(self, run_id: str | None = None, status: str | None = None) -> list[dict]:
        return [
            deepcopy(p)
            for p in self.proposals
            if (run_id is None or p["run_id"] == run_id) and (status is None or p["status"] == status)
        ]

    def update_proposal(self, proposal_id: int, fields: dict) -> None:
        for p in self.proposals:
            if p["id"] == proposal_id:
                p.update(deepcopy(fields))
                return
        raise KeyError(f"no proposal {proposal_id}")

    # ---- insights ------------------------------------------------------
    def _superseded_by(self) -> dict[int, int]:
        """decision id -> id of the newest decision that replaced it (via a contradicts/supersedes conflict)."""
        out: dict[int, int] = {}
        for i in sorted(self.issues.values(), key=lambda i: i["id"]):
            if i["type"] != "conflict" or i.get("details", {}).get("relation") not in ("contradicts", "supersedes"):
                continue
            old, new = i.get("related_decision_id"), i.get("decision_id")
            if old is not None and new is not None and old != new:
                out[old] = new
        return out

    def _decision_row(self, d: dict, superseded: dict[int, int]) -> dict:
        meeting = self.meetings[d["meeting_id"]]
        row = {k: v for k, v in d.items() if k != "embedding"}
        by = superseded.get(d["id"])
        row.update(
            meeting_title=meeting["title"],
            held_at=meeting["held_at"],
            status="superseded" if by is not None else "current",
            superseded_by=by,
        )
        return row

    def _task_row(self, t: dict) -> dict:
        meeting = self.meetings[t["meeting_id"]]
        owner = next((p for p in self.people if p["id"] == t.get("owner_id")), None)
        row = {k: v for k, v in t.items() if k != "embedding"}
        row.update(
            owner_name=owner["name"] if owner else None,
            meeting_title=meeting["title"],
            meeting_date=meeting["held_at"][:10],
        )
        row.setdefault("deadline", None)
        row.setdefault("deadline_confidence", "none")
        return row

    def list_decisions(self, topic: str | None = None) -> list[dict]:
        superseded = self._superseded_by()
        rows = [
            self._decision_row(d, superseded)
            for d in self.decisions.values()
            if topic is None or topic.lower() in d["topic"].lower()
        ]
        return deepcopy(sorted(rows, key=lambda r: (r["held_at"], r["id"])))

    def list_tasks(self, owner_id=None, status: str | None = None) -> list[dict]:
        rows = [
            self._task_row(t)
            for t in self.tasks.values()
            if (owner_id is None or t.get("owner_id") == owner_id) and (status is None or t["status"] == status)
        ]
        return deepcopy(sorted(rows, key=lambda r: r["id"]))

    def list_task_updates(self, task_id=None) -> list[dict]:
        rows = []
        for u in self.task_updates:
            if task_id is not None and u["task_id"] != task_id:
                continue
            meeting = self.meetings[u["meeting_id"]]
            rows.append({**u, "meeting_title": meeting["title"], "meeting_date": meeting["held_at"][:10]})
        return deepcopy(sorted(rows, key=lambda r: r["id"]))

    def list_issues(self, status: str | None = None, issue_type: str | None = None) -> list[dict]:
        return [
            deepcopy(i)
            for i in sorted(self.issues.values(), key=lambda i: i["id"])
            if (status is None or i["status"] == status) and (issue_type is None or i["type"] == issue_type)
        ]

    def search_decisions(self, embedding, k) -> list[dict]:
        superseded = self._superseded_by()
        scored = [
            {**self._decision_row(d, superseded), "similarity": cosine(embedding, d["embedding"])}
            for d in self.decisions.values()
            if d.get("embedding") is not None
        ]
        return deepcopy(sorted(scored, key=lambda r: r["similarity"], reverse=True)[:k])

    def search_tasks(self, embedding, k) -> list[dict]:
        scored = [
            {**self._task_row(t), "similarity": cosine(embedding, t["embedding"])}
            for t in self.tasks.values()
            if t.get("embedding") is not None
        ]
        return deepcopy(sorted(scored, key=lambda r: r["similarity"], reverse=True)[:k])

    def save_brief(self, brief: dict) -> dict:
        row = {**deepcopy(brief), "id": self._next("briefs"), "created_at": datetime.now(timezone.utc).isoformat()}
        self.briefs[row["id"]] = row
        return deepcopy(row)

    def get_brief(self, brief_id) -> dict:
        return deepcopy(self.briefs[brief_id])

    def list_briefs(self) -> list[dict]:
        return deepcopy(sorted(self.briefs.values(), key=lambda b: b["id"], reverse=True))
