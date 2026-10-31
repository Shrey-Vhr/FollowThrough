"""The app's notion of "now": real time plus a demo offset (POST /dev/fast-forward)."""
from datetime import datetime, timedelta, timezone

_offset = timedelta(0)


def now() -> datetime:
    return datetime.now(timezone.utc) + _offset


def fast_forward(hours: float) -> datetime:
    global _offset
    _offset += timedelta(hours=hours)
    return now()


def set_to(target: datetime) -> datetime:
    global _offset
    _offset = target.astimezone(timezone.utc) - datetime.now(timezone.utc)
    return now()


def reset() -> datetime:
    global _offset
    _offset = timedelta(0)
    return now()


def offset_hours() -> float:
    return _offset.total_seconds() / 3600
