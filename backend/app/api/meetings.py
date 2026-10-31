from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from app.db import repo
from app.services.transcript_parser import parse_transcript

router = APIRouter(prefix="/meetings", tags=["meetings"])


class PasteIn(BaseModel):
    title: str
    held_at: datetime
    text: str


def ingest_text(title: str, held_at: str, source: str, text: str, **extra):
    segments = parse_transcript(text)
    if not segments:
        raise HTTPException(400, "No 'Speaker: text' lines found in the transcript")
    meeting = repo.create_meeting(title=title, held_at=held_at, source=source, **extra)
    count = repo.insert_segments(meeting["id"], segments)
    return {"meeting_id": meeting["id"], "segments": count}


@router.post("/paste")
def paste_meeting(body: PasteIn):
    return ingest_text(body.title, body.held_at.isoformat(), "paste", body.text)


@router.post("/upload")
async def upload_meeting(
    file: UploadFile = File(...),
    title: str = Form(...),
    held_at: datetime = Form(...),
):
    text = (await file.read()).decode("utf-8", errors="ignore")
    return ingest_text(title, held_at.isoformat(), "upload", text)


@router.get("")
def list_meetings():
    return repo.list_meetings()


@router.get("/{meeting_id}")
def get_meeting(meeting_id: str):
    meeting = repo.get_meeting_full(meeting_id)
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return meeting