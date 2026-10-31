"""Dev-only: put the Supabase database into the demo starting state."""
import asyncio
import uuid

from fastapi import APIRouter, HTTPException

from app.agents import runtime
from app.agents.graphs.ingest import resume_run, start_run
from app.api import runs
from app.db import repo
from app.services import seed

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/reset-supabase")
async def reset_supabase():
    """Wipe data (keep people), import the 3 seed meetings, process meetings 1-2 (cached) and approve
    everything. Meeting 3 is imported but NOT processed, so "Run agent" can be clicked live."""
    if not runtime.use_supabase_store():
        raise HTTPException(400, "USE_SUPABASE_STORE is not true")
    await asyncio.to_thread(seed.clear_data)
    runs.RUNS.clear()
    runtime.reset()
    graph = runtime.get_ingest_graph()
    meetings = await seed.import_seed_meetings()
    for m in meetings:
        if m["n"] == 3:
            continue
        run_id = str(uuid.uuid4())
        proposals = await start_run(graph, m["meeting_id"], run_id, use_cache=True, cache_path=m["cache_path"])
        await resume_run(graph, run_id, [{"action": "approve", "proposal_ids": [p["id"] for p in proposals]}])
        repo.set_meeting_status(m["meeting_id"], "processed")
    return {
        "meeting_ids": [m["meeting_id"] for m in meetings],
        "unprocessed_meeting_id": meetings[2]["meeting_id"],
        "sources": [m["source"] for m in meetings],
    }
