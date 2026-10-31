"""Every minute: Slack-remind owners of tasks due within 24h (relative to the app clock), once per task."""
import asyncio
import logging
from datetime import date, datetime, time, timedelta, timezone

from app.agents import runtime
from app.db.client import get_db
from app.services import clock

logger = logging.getLogger(__name__)
IST = timezone(timedelta(hours=5, minutes=30))
WINDOW = timedelta(hours=24)


def _due_at(deadline: str) -> datetime:
    """A date-only deadline is due at the end of that day (IST)."""
    return datetime.combine(date.fromisoformat(deadline), time(23, 59, 59), tzinfo=IST)


def _when(deadline: str, now: datetime) -> str:
    days = (date.fromisoformat(deadline) - now.astimezone(IST).date()).days
    return "today" if days <= 0 else "tomorrow" if days == 1 else f"on {date.fromisoformat(deadline):%b} {date.fromisoformat(deadline).day}"


def _find_due(now: datetime) -> list[dict]:
    db = get_db()
    tasks = (db.table("tasks").select("id,title,owner_id,deadline,status").neq("status", "completed")
             .not_.is_("deadline", "null").execute().data)
    sent = {r["task_id"] for r in db.table("reminders").select("task_id").eq("sent", True).execute().data}
    people = {p["id"]: p for p in db.table("people").select("id,name,slack_user_id").execute().data}
    due = []
    for t in tasks:
        if t["id"] in sent or not (now <= _due_at(t["deadline"]) <= now + WINDOW):
            continue
        due.append({**t, "owner": (people.get(t["owner_id"]) or {}).get("name")})
    return due


def _record(task_id: str, now: datetime) -> None:
    get_db().table("reminders").insert({"task_id": task_id, "remind_at": now.isoformat(), "sent": True}).execute()


async def send_due_reminders() -> list[dict]:
    now = clock.now()
    due = await asyncio.to_thread(_find_due, now)
    executor, results = runtime.get_executor(), []
    for t in due:
        text = f"⏰ Reminder: '{t['title']}' is due {_when(t['deadline'], now)}"
        proposal = {"id": f"reminder-{t['id']}", "kind": "slack_message", "meeting_id": None,
                    "payload": {"user": t["owner"], "channel": "team", "text": text}}
        result = executor(proposal)
        if asyncio.iscoroutine(result):
            result = await result
        if result.get("ok"):
            await asyncio.to_thread(_record, t["id"], now)
        else:
            logger.error("reminder for task %s failed: %s", t["id"], result.get("error"))
        results.append({"task_id": t["id"], "task": t["title"], "text": text, "ok": bool(result.get("ok")),
                        "external_id": result.get("external_id"), "error": result.get("error")})
    return results
