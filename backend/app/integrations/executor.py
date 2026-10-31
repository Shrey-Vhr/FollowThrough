"""Real executor: routes an approved proposal to Notion / Slack / email.

executor(proposal) -> {"ok", "external_id", "url", "error"}. external_id is the link when there is one
(Notion page URL, Slack permalink) so the frontend can show "Open in Notion" / "View in Slack"."""
import asyncio
import logging
import os

from app.db.client import get_db

logger = logging.getLogger(__name__)


def use_real_integrations() -> bool:
    return os.getenv("USE_REAL_INTEGRATIONS", "").strip().lower() == "true"


def _person(name: str | None) -> dict | None:
    if not name:
        return None
    for p in get_db().table("people").select("id,name,email,slack_user_id,aliases").execute().data:
        if name.strip().lower() in [p["name"].lower(), *[a.lower() for a in p.get("aliases") or []]]:
            return p
    return None


def _meeting_title(meeting_id) -> str | None:
    if not meeting_id:
        return None
    rows = get_db().table("meetings").select("title").eq("id", meeting_id).limit(1).execute().data
    return rows[0]["title"] if rows else None


def _send(proposal: dict) -> dict:
    from app.integrations import email, notion, slack

    kind, pl = proposal["kind"], proposal["payload"]
    if kind == "notion_task":
        r = notion.create_task(
            title=pl.get("title") or "Untitled task", owner=pl.get("owner"),
            due_date=pl.get("deadline") or pl.get("due_date"),
            source_meeting=_meeting_title(proposal.get("meeting_id")))
    elif kind == "slack_message":
        target = _person(pl.get("user") or pl.get("to"))
        if target and target.get("slack_user_id"):
            r = slack.send_dm(target["slack_user_id"], pl["text"])
        else:
            ch = pl.get("channel")
            r = slack.post_message(pl["text"], ch if ch and ch[:1] in "CGD" and ch.isupper() else None)
    elif kind == "email":
        r = email.send_email(pl["to"], pl.get("subject") or "(no subject)", pl.get("body") or "")
    else:
        raise ValueError(f"unknown proposal kind {kind!r}")
    return {"ok": True, "external_id": r.get("url") or r["id"], "url": r.get("url"), "error": None}


async def real_executor(proposal: dict) -> dict:
    # Idempotent: a proposal that already went out is never sent again.
    if proposal.get("status") == "sent" and (proposal.get("result") or {}).get("ok"):
        return proposal["result"]
    try:
        return await asyncio.to_thread(_send, proposal)
    except Exception as exc:  # noqa: BLE001 - the graph records it as a failed proposal
        logger.exception("executor failed for proposal %s", proposal.get("id"))
        return {"ok": False, "external_id": None, "url": None, "error": f"{type(exc).__name__}: {exc}"}
