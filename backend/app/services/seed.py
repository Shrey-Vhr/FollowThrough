"""Seed-data helpers shared by test_store.py and POST /dev/reset-supabase."""
from pathlib import Path

import psycopg

from app.config import DATABASE_URL
from app.db import repo
from app.integrations import wispr_mcp
from app.services.transcript_parser import parse_transcript

SEED = Path(__file__).resolve().parents[3] / "seed"
# (seed number, wispr meeting id, title, real date)
SEED_MEETINGS = [
    (1, "d1cb0d3f-0cb5-473f-97e4-3a70b01786f4", "Launch Kickoff", "2026-10-17T11:00:00+05:30"),
    (2, "8e542984-be05-4dff-b93e-11714c2895ad", "Launch Sync", "2026-10-24T11:00:00+05:30"),
    (3, "5bd3ae48-fb68-477f-baee-e4b65e05f528", "Launch Review", "2026-10-31T11:00:00+05:30"),
]
DATA_TABLES = "proposals, reminders, briefs, task_updates, issues, tasks, decisions, segments, meetings"


def clear_data() -> None:
    """Wipe every data table (people is kept); proposal ids restart at 1."""
    with psycopg.connect(DATABASE_URL, autocommit=True, prepare_threshold=None) as c:
        c.execute(f"truncate {DATA_TABLES} restart identity cascade")


async def import_seed_meetings(prefer_wispr: bool = True) -> list[dict]:
    """Import the 3 seed meetings with their real dates. Wispr MCP first, seed/*.txt as fallback."""
    out = []
    for n, wispr_id, title, held_at in SEED_MEETINGS:
        text, summary, source, wid = None, None, "upload", None
        if prefer_wispr and wispr_mcp.TOKEN_FILE.exists():
            try:
                data = await wispr_mcp.get_meeting(wispr_id)
                text, summary, source, wid = data.get("transcript"), data.get("summary"), "wispr", wispr_id
            except Exception as exc:  # noqa: BLE001 - fall back to the local copy
                print(f"[seed] Wispr import failed for meeting {n} ({exc}); using seed/meeting{n}.txt")
        if not parse_transcript(text or ""):
            text = (SEED / f"meeting{n}.txt").read_text(encoding="utf-8")
            source, wid, summary = "upload", None, None
        meeting = repo.create_meeting(title, held_at, source, wispr_meeting_id=wid, wispr_summary=summary)
        repo.insert_segments(meeting["id"], parse_transcript(text))
        out.append({"n": n, "meeting_id": meeting["id"], "title": title, "source": source,
                    "cache_path": str(SEED / "extractions" / f"meeting{n}.json")})
    return out


def cache_path_for(meeting: dict) -> str | None:
    """Cached extraction for a seed meeting (matched by Wispr id or title), else None."""
    for n, wispr_id, title, _ in SEED_MEETINGS:
        if meeting.get("wispr_meeting_id") == wispr_id or meeting.get("title") == title:
            return str(SEED / "extractions" / f"meeting{n}.json")
    return None
