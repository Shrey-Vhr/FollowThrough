"""HTTP API for the insight views: pre-meeting briefs, weekly digest, commitments, decision ledger,
plus plain issue / task listings."""
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents import runtime
from app.agents.graphs.brief import decision_groups, run_brief
from app.agents.graphs.digest import is_overdue, run_digest

router = APIRouter(tags=["insights"])


def _coerce_id(raw: str):
    """Path ids are opaque to the store: ints in memory, uuids in Supabase."""
    return int(raw) if raw.isdigit() else raw


# ---- briefs ------------------------------------------------------------

class BriefIn(BaseModel):
    agenda: str = Field(min_length=1)
    meeting_at: str | None = None


@router.post("/briefs")
async def create_brief(body: BriefIn) -> dict[str, Any]:
    """Build and save a pre-meeting brief from a free-text agenda."""
    if not body.agenda.strip():
        raise HTTPException(422, "The agenda is empty.")
    return await run_brief(runtime.get_store(), body.agenda.strip(), body.meeting_at)


@router.get("/briefs")
def list_briefs() -> list[dict[str, Any]]:
    """Saved briefs, newest first."""
    return runtime.get_store().list_briefs()


@router.get("/briefs/{brief_id}")
def get_brief(brief_id: str) -> dict[str, Any]:
    try:
        return runtime.get_store().get_brief(_coerce_id(brief_id))
    except LookupError:
        raise HTTPException(404, f"No brief {brief_id}.")


# ---- weekly digest -----------------------------------------------------

class DigestIn(BaseModel):
    today: date | None = None  # demo override; defaults to the real today


class DigestOut(BaseModel):
    proposals_created: int
    proposal_ids: list[int]


@router.post("/digests/run", response_model=DigestOut)
async def run_weekly_digest(body: DigestIn | None = None):
    """Draft one email per person as pending proposals in the Review Queue. Nothing is sent."""
    today = body.today.isoformat() if body and body.today else None
    result = await run_digest(runtime.get_store(), today)
    ids = [p["id"] for p in result["proposals"]]
    return {"proposals_created": len(ids), "proposal_ids": ids}


# ---- commitments -------------------------------------------------------

@router.get("/commitments")
def commitments(today: date | None = None) -> list[dict[str, Any]]:
    """Per person: how much they committed to, how much they delivered, and how often it slipped."""
    store = runtime.get_store()
    today_iso = (today or date.today()).isoformat()
    tasks = store.list_tasks()
    out = []
    for person in store.list_people():
        mine = [t for t in tasks if t.get("owner_id") == person["id"]]
        completed = [t for t in mine if t["status"] == "completed"]
        out.append({
            "person_id": person["id"],
            "name": person["name"],
            "committed": len(mine),
            "completed": len(completed),
            "open": len(mine) - len(completed),
            "overdue": sum(is_overdue(t, today_iso) for t in mine),
            "total_rollovers": sum(t.get("rollover_count", 0) for t in mine),
            "follow_through_rate": len(completed) / len(mine) if mine else 0.0,
            "tasks": [
                {**t, "overdue": is_overdue(t, today_iso), "history": store.list_task_updates(t["id"])}
                for t in mine
            ],
        })
    return out


# ---- decision ledger ---------------------------------------------------

def _groups(store) -> tuple[list[list[dict]], list[dict]]:
    conflicts = store.list_issues(issue_type="conflict")
    return decision_groups(store.list_decisions(), conflicts), conflicts


def _conflicts_within(group: list[dict], conflicts: list[dict]) -> list[dict]:
    ids = {d["id"] for d in group}
    return [c for c in conflicts if c.get("decision_id") in ids and c.get("related_decision_id") in ids]


@router.get("/ledger/decisions")
def ledger_decisions(topic: str | None = None) -> list[dict[str, Any]]:
    """Decisions grouped by subject (same topic, or linked by a conflict), oldest -> newest."""
    groups, conflicts = _groups(runtime.get_store())
    if topic:
        needle = topic.lower()
        groups = [g for g in groups if any(needle in d["topic"].lower() for d in g)]
    return [
        {
            "topic": g[0]["topic"],
            "current": next((d for d in reversed(g) if d["status"] == "current"), g[-1]),
            "history": g,
            "has_conflict": bool(_conflicts_within(g, conflicts)),
        }
        for g in groups
    ]


@router.get("/ledger/lineage/{decision_id}")
def ledger_lineage(decision_id: str) -> dict[str, Any]:
    """The chain of decisions on the same subject as this one, with the conflicts between them."""
    groups, conflicts = _groups(runtime.get_store())
    group = next((g for g in groups if any(str(d["id"]) == decision_id for d in g)), None)
    if group is None:
        raise HTTPException(404, f"No decision {decision_id}.")
    return {
        "decision_id": _coerce_id(decision_id),
        "topic": group[0]["topic"],
        "chain": group,
        "conflicts": _conflicts_within(group, conflicts),
    }


# ---- plain listings ----------------------------------------------------

@router.get("/issues")
def list_issues(status: str | None = None, type: str | None = None) -> list[dict[str, Any]]:
    return runtime.get_store().list_issues(status=status, issue_type=type)


@router.get("/tasks")
def list_tasks(
    due_within_days: int | None = None,
    owner_id: str | None = None,
    status: str | None = None,
    today: date | None = None,
) -> list[dict[str, Any]]:
    """All tasks. With due_within_days: not-completed tasks due on or before today + N days
    (already-overdue ones included, flagged `overdue`), soonest first."""
    today_iso = (today or date.today()).isoformat()
    rows = runtime.get_store().list_tasks(owner_id=_coerce_id(owner_id) if owner_id else None, status=status)
    rows = [{**t, "overdue": is_overdue(t, today_iso)} for t in rows]
    if due_within_days is not None:
        limit = ((today or date.today()) + timedelta(days=due_within_days)).isoformat()
        rows = [t for t in rows if t["status"] != "completed" and t["deadline"] and t["deadline"] <= limit]
        rows.sort(key=lambda t: t["deadline"])
    return rows
