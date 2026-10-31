from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.db import repo
from app.integrations import wispr_mcp
from app.services.transcript_parser import parse_transcript

router = APIRouter(tags=["wispr"])


@router.get("/wispr/meetings")
async def wispr_meetings():
    meetings = await wispr_mcp.list_meetings()
    return [
        {
            "wispr_meeting_id": m["id"],
            "title": m.get("title") or "Untitled meeting",
            "start": m.get("start"),
            "has_transcript": m.get("has_transcript"),
            "summary_excerpt": m.get("content_excerpt"),
            "already_imported": repo.find_meeting_by_wispr_id(m["id"]) is not None,
        }
        for m in meetings
    ]


class ImportIn(BaseModel):
    wispr_meeting_id: str
    title: str | None = None
    held_at: datetime | None = None  # override: seed meetings were all recorded today


@router.post("/meetings/import/wispr")
async def import_wispr_meeting(body: ImportIn):
    existing = repo.find_meeting_by_wispr_id(body.wispr_meeting_id)
    if existing:
        return {"meeting_id": existing["id"], "segments": None, "already_imported": True}

    data = await wispr_mcp.get_meeting(body.wispr_meeting_id)
    segments = parse_transcript(data.get("transcript") or "")
    if not segments:
        raise HTTPException(400, "This Wispr meeting has no transcript yet")

    meeting = repo.create_meeting(
        title=body.title or data.get("title") or "Untitled meeting",
        held_at=body.held_at.isoformat() if body.held_at else data.get("start"),
        source="wispr",
        wispr_meeting_id=body.wispr_meeting_id,
        wispr_summary=data.get("summary"),
    )
    count = repo.insert_segments(meeting["id"], segments)
    return {"meeting_id": meeting["id"], "segments": count, "already_imported": False}