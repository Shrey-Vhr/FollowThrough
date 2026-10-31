"""Start an ingest run for a meeting and stream its progress over SSE."""
import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.agents import runtime
from app.agents.graphs.ingest import start_run_stream
from app.db import repo
from app.services import seed

logger = logging.getLogger(__name__)
router = APIRouter(tags=["runs"])


class RunBuffer:
    """Every event of a run, kept so a late subscriber can replay it, plus a wake-up for live ones."""

    def __init__(self) -> None:
        self.events: list[dict] = []
        self.finished = False
        self._wake = asyncio.Event()

    def push(self, event: dict) -> None:
        self.events.append(event)
        self._wake.set()

    def finish(self) -> None:
        self.finished = True
        self._wake.set()

    async def wait(self) -> None:
        await self._wake.wait()
        self._wake.clear()


RUNS: dict[str, RunBuffer] = {}


async def execute_run(run_id: str, meeting_id: str, use_cache: bool, cache_path: str | None) -> list[dict]:
    """Run the ingest graph to its human_review pause, buffering events. Returns the pending proposals."""
    buf = RUNS.setdefault(run_id, RunBuffer())
    proposals: list[dict] = []
    saw_review = False
    try:
        graph = runtime.get_ingest_graph()
        async for item in start_run_stream(graph, meeting_id, run_id, use_cache=use_cache, cache_path=cache_path):
            if item["type"] == "event":
                event = {k: item[k] for k in ("node", "status", "message", "data") if k in item}
                saw_review = saw_review or event.get("node") == "human_review"
                buf.push(event)
            else:
                proposals = item["proposals"]
        if not saw_review:  # the frontend closes its EventSource on human_review
            buf.push({"node": "human_review", "status": "done",
                      "message": f"{len(proposals)} proposals ready for review", "data": {"proposals": len(proposals)}})
    except Exception as exc:  # noqa: BLE001
        logger.exception("run %s failed", run_id)
        buf.push({"node": "error", "status": "error", "message": str(exc), "data": {}})
    finally:
        buf.finish()
    return proposals


@router.post("/meetings/{meeting_id}/process")
async def process_meeting(meeting_id: str, use_cache: bool | None = None):
    meeting = repo.get_meeting_full(meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    cache_path = seed.cache_path_for(meeting)
    if use_cache is None:  # seed meetings use their cached extraction so the demo never waits on the LLM
        use_cache = cache_path is not None
    run_id = str(uuid.uuid4())
    RUNS[run_id] = RunBuffer()
    asyncio.create_task(execute_run(run_id, meeting_id, use_cache, cache_path if use_cache else None))
    return {"run_id": run_id}


@router.get("/runs/{run_id}/stream")
async def stream_run(run_id: str):
    buf = RUNS.get(run_id)
    if buf is None:
        raise HTTPException(404, "Unknown run")

    async def gen():
        i = 0
        while True:
            while i < len(buf.events):
                event = buf.events[i]
                i += 1
                yield {"data": json.dumps(event)}
                if event.get("status") == "error":
                    yield {"event": "error", "data": json.dumps(event)}
            if buf.finished and i >= len(buf.events):
                yield {"event": "end", "data": "{}"}
                return
            await buf.wait()

    return EventSourceResponse(gen())
