"""Destructive integration check: SupabaseStore + ingest graph on the 3 seed meetings.

Run from backend/:  python -m app.db.test_store
"""
import asyncio
import uuid

from app.agents.graphs.ingest import build_ingest_graph, resume_run, start_run
from app.db.client import get_db
from app.db.store import SupabaseStore
from app.services import seed


async def run_ingest_check() -> bool:
    seed.clear_data()
    store = SupabaseStore()
    graph = build_ingest_graph(store)
    meetings = await seed.import_seed_meetings()
    pending = []
    for m in meetings:
        run_id = str(uuid.uuid4())
        proposals = await start_run(graph, m["meeting_id"], run_id, use_cache=True, cache_path=m["cache_path"])
        print(f"meeting {m['n']} ({m['source']}): {len(proposals)} proposals")
        if m["n"] < 3:
            await resume_run(graph, run_id, [{"action": "approve", "proposal_ids": [p["id"] for p in proposals]}])
        else:
            pending = proposals

    db = get_db()
    conflicts = db.table("issues").select("id").eq("type", "conflict").execute().data
    tasks = db.table("tasks").select("title,rollover_count").execute().data
    pending_db = store.get_proposals(status="pending")
    checks = (
        ("3 conflict issues", len(conflicts) == 3, len(conflicts)),
        ("API spec rollover_count == 2", any("api spec" in t["title"].lower() and t["rollover_count"] == 2 for t in tasks), None),
        ("~7 pending proposals", 6 <= len(pending_db) <= 8, len(pending_db)),
        ("meeting 3 paused with proposals", bool(pending), len(pending)),
    )
    ok = True
    for label, passed, value in checks:
        ok &= passed
        print(f"[{'PASS' if passed else 'FAIL'}] {label}" + (f" ({value})" if value is not None else ""))
    return ok


if __name__ == "__main__":
    raise SystemExit(0 if asyncio.run(run_ingest_check()) else 1)
