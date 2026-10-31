import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager

if sys.platform == "win32":  # psycopg async needs the selector loop
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents import runtime
from app.agents import api_dev, api_insights, api_proposals
from app.api import dev_supabase, issues, meetings, runs, wispr
from app.config import DATABASE_URL, FRONTEND_ORIGIN

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = None
    if os.getenv("USE_POSTGRES_CHECKPOINTER", "").strip().lower() == "true":
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        from psycopg_pool import AsyncConnectionPool

        pool = AsyncConnectionPool(
            DATABASE_URL, max_size=5, open=False,
            kwargs={"autocommit": True, "prepare_threshold": 0},
        )
        await pool.open()
        saver = AsyncPostgresSaver(pool)
        await saver.setup()
        runtime.set_checkpointer(saver)
        logger.info("Postgres checkpointer enabled")
    try:
        yield
    finally:
        if pool is not None:
            await pool.close()


app = FastAPI(title="FollowThrough API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list({FRONTEND_ORIGIN, "http://localhost:3000", "http://localhost:3001",
                        "http://127.0.0.1:3000", "http://127.0.0.1:3001"}),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


for r in (meetings.router, wispr.router, runs.router, issues.router, dev_supabase.router, api_proposals.router, api_dev.router, api_insights.router):
    app.include_router(r)


def selector_loop_factory(use_subprocess: bool = False):
    """For `uvicorn --loop app.main:selector_loop_factory` on Windows: psycopg async can't use Proactor."""
    return asyncio.SelectorEventLoop()
