import asyncio
import sys

if sys.platform == "win32":  # psycopg async needs the selector loop
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents import api_dev, api_insights, api_proposals
from app.api import meetings, wispr
from app.config import FRONTEND_ORIGIN

app = FastAPI(title="FollowThrough API")

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


for r in (meetings.router, wispr.router, api_proposals.router, api_dev.router, api_insights.router):
    app.include_router(r)
