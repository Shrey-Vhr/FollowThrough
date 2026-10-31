"""Destructive Supabase integration check for SupabaseStore and the ingest graph."""

import asyncio
import uuid
from pathlib import Path

from app.agents.graphs.ingest import build_ingest_graph, resume_run, start_run
from app.api.meetings import ingest_text
from app.db.client import get_db
from app.db.store import SupabaseStore


ROOT = Path(__file__).resolve().parents[3]
SEED = ROOT / "seed"
MEETINGS = (
    (1, "Launch Kickoff", "2026-10-17"),
    (2, "Launch Sync", "2026-10-24"),
    (3, "Launch Review", "2026-10-31"),
)
TABLES_TO_CLEAR = (
    ("proposals", 0),
    ("reminders", 0),
    ("briefs", "00000000-0000-0000-0000-000000000000"),
    ("task_updates", 0),
    ("issues", "00000000-0000-0000-0000-000000000000"),
    ("tasks", "00000000-0000-0000-0000-000000000000"),
    ("decisions", "00000000-0000-0000-0000-000000000000"),
    ("segments", 0),
    ("meetings", "00000000-0000-0000-0000-000000000000"),
)


def clear_data_tables() -> None:
    db = get_db()
    db.table("decisions").update({"superseded_by": None}).neq(
        "id", "00000000-0000-0000-0000-000000000000"
    ).execute()
    for table, impossible_id in TABLES_TO_CLEAR:
        db.table(table).delete().neq("id", impossible_id).execute()


def load_seed_meeting(number: int, title: str, held_at: str) -> str:
    text = (SEED / f"meeting{number}.txt").read_text(encoding="utf-8")
    result = ingest_text(
        title,
        f"{held_at}T00:00:00+00:00",
        "upload",
        text,
    )
    return result["meeting_id"]


async def run_ingest_check() -> None:
    clear_data_tables()
    store = SupabaseStore()
    graph = build_ingest_graph(store)
    pending = []

    for number, title, held_at in MEETINGS:
        meeting_id = load_seed_meeting(number, title, held_at)
        run_id = str(uuid.uuid4())
        cache_path = str(SEED / "extractions" / f"meeting{number}.json")
        proposals = await start_run(
            graph,
            meeting_id,
            run_id,
            use_cache=True,
            cache_path=cache_path,
        )
        if number < 3:
            await resume_run(
                graph,
                run_id,
                [{"action": "approve", "proposal_ids": [p["id"] for p in proposals]}],
            )
        else:
            pending = proposals

    db = get_db()
    conflicts = (
        db.table("issues")
        .select("id")
        .eq("type", "conflict")
        .execute()
        .data
    )
    tasks = (
        db.table("tasks")
        .select("id,title,rollover_count")
        .execute()
        .data
    )
    pending_proposals = store.get_proposals(status="pending")
    api_spec_rolled_twice = any(
        "api spec" in task["title"].lower() and task["rollover_count"] == 2
        for task in tasks
    )

    checks = (
        ("3 conflict issues exist", len(conflicts) == 3, len(conflicts)),
        ("API spec task rollover_count == 2", api_spec_rolled_twice, None),
        ("~7 pending proposals", 6 <= len(pending_proposals) <= 8, len(pending_proposals)),
        ("meeting 3 paused with pending proposals", bool(pending), len(pending)),
    )
    for label, passed, value in checks:
        detail = f" ({value})" if value is not None else ""
        print(f"[{'PASS' if passed else 'FAIL'}] {label}{detail}")


if __name__ == "__main__":
    asyncio.run(run_ingest_check())
