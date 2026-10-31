from app.db.client import get_db


def list_people():
    return get_db().table("people").select("*").execute().data


def resolve_person_id(speaker: str, people: list[dict]):
    s = speaker.strip().lower()
    for p in people:
        names = [p["name"]] + (p.get("aliases") or [])
        if any(s == n.lower() for n in names):
            return p["id"]
    return None


def create_meeting(title, held_at, source, wispr_meeting_id=None, wispr_summary=None):
    row = {
        "title": title,
        "held_at": held_at,
        "source": source,
        "wispr_meeting_id": wispr_meeting_id,
        "wispr_summary": wispr_summary,
    }
    return get_db().table("meetings").insert(row).execute().data[0]


def insert_segments(meeting_id: str, segments: list[dict]) -> int:
    people = list_people()
    rows = [
        {
            "meeting_id": meeting_id,
            "idx": idx,
            "speaker": s["speaker"],
            "person_id": resolve_person_id(s["speaker"], people),
            "ts_seconds": s.get("ts_seconds"),
            "text": s["text"],
        }
        for idx, s in enumerate(segments)
    ]
    if rows:
        get_db().table("segments").insert(rows).execute()
    return len(rows)


def list_meetings():
    return (
        get_db().table("meetings")
        .select("id,title,held_at,source,status,created_at")
        .order("held_at", desc=True)
        .execute().data
    )


def find_meeting_by_wispr_id(wispr_meeting_id: str):
    data = (
        get_db().table("meetings").select("*")
        .eq("wispr_meeting_id", wispr_meeting_id).limit(1).execute().data
    )
    return data[0] if data else None


def get_meeting_full(meeting_id: str):
    db = get_db()
    rows = db.table("meetings").select("*").eq("id", meeting_id).limit(1).execute().data
    if not rows:
        return None
    meeting = rows[0]
    meeting["segments"] = db.table("segments").select("*").eq("meeting_id", meeting_id).order("id").execute().data
    meeting["decisions"] = db.table("decisions").select("id,topic,statement,made_by,source_quote,status").eq("meeting_id", meeting_id).execute().data
    meeting["tasks"] = db.table("tasks").select("id,title,owner_id,deadline,deadline_raw,deadline_confidence,status,rollover_count,source_quote").eq("meeting_id", meeting_id).execute().data
    meeting["issues"] = db.table("issues").select("*").eq("meeting_id", meeting_id).execute().data
    return meeting