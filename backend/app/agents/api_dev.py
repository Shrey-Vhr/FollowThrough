"""Dev-only helpers: fill the in-memory store with demo data so the Review Queue has something to show."""
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents import runtime
from app.agents.graphs.ingest import resume_run, start_run

router = APIRouter(prefix="/dev", tags=["dev"])

SEED = Path(__file__).resolve().parents[3] / "seed"
MEETINGS = [
    (1, "Launch Kickoff", "2026-10-17"),
    (2, "Launch Sync", "2026-10-24"),
    (3, "Launch Review", "2026-10-31"),
]


class SeedDemoOut(BaseModel):
    meeting_ids: list[int]
    run_id: str
    pending: int


@router.post("/seed-demo", response_model=SeedDemoOut)
async def seed_demo():
    """Reset the in-memory store, ingest the 3 seed meetings. Meetings 1-2 are approved and sent
    (dry-run); meeting 3 stops at human_review, so only its proposals are pending."""
    if runtime.use_supabase_store():
        raise HTTPException(400, "seed-demo only works with the in-memory store (USE_SUPABASE_STORE is true).")
    runtime.reset()
    store = runtime.get_store()
    graph = runtime.get_ingest_graph()

    meeting_ids: list[int] = []
    run_id, pending = "", []
    for n, title, held_at in MEETINGS:
        meeting_id = store.load_seed_meeting(SEED / f"meeting{n}.txt", title, held_at)
        meeting_ids.append(meeting_id)
        run_id = str(uuid.uuid4())
        last = n == MEETINGS[-1][0]
        cache = str(SEED / "extractions" / f"meeting{n}.json") if last else None
        pending = await start_run(graph, meeting_id, run_id, use_cache=last, cache_path=cache)
        if not last:  # the team handled these back then: approve everything (dry-run executor "sends" it)
            approve = [{"action": "approve", "proposal_ids": [p["id"] for p in pending],
                        "to": None, "date": None, "text": None}]
            await resume_run(graph, run_id, approve)
    pending = store.get_proposals(status="pending")
    return {"meeting_ids": meeting_ids, "run_id": run_id, "pending": len(pending)}
