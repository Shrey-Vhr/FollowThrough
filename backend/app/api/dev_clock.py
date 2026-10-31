"""Dev-only: the app clock used by the reminder scheduler, so reminders can fire on camera."""
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.scheduler.reminders import send_due_reminders
from app.services import clock

router = APIRouter(prefix="/dev", tags=["dev"])


class FastForward(BaseModel):
    hours: float | None = None
    reset: bool = False
    to: datetime | None = None  # jump straight to this moment instead of shifting by hours


def _state() -> dict:
    return {"now": clock.now().isoformat(), "offset_hours": round(clock.offset_hours(), 3)}


@router.get("/now")
def get_now():
    return _state()


@router.post("/fast-forward")
def fast_forward(body: FastForward):
    if body.reset:
        clock.reset()
    elif body.to is not None:
        if body.to.tzinfo is None:
            raise HTTPException(422, "'to' needs a timezone offset")
        clock.set_to(body.to)
    elif body.hours is not None:
        clock.fast_forward(body.hours)
    else:
        raise HTTPException(422, "Send hours, to, or reset: true")
    return _state()


@router.post("/run-reminders")
async def run_reminders():
    """Run the reminder job now instead of waiting for the next minute."""
    return {"sent": await send_due_reminders(), **_state()}
