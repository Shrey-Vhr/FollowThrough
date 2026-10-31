"""Slack: post to the team channel or DM a user. Both return the message permalink."""
import os

import logging

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

logger = logging.getLogger(__name__)


def _client() -> WebClient:
    return WebClient(token=os.environ["SLACK_BOT_TOKEN"])


def _post(channel: str, text: str) -> dict:
    client = _client()
    res = client.chat_postMessage(channel=channel, text=text)
    try:
        link = client.chat_getPermalink(channel=res["channel"], message_ts=res["ts"])["permalink"]
    except Exception:  # noqa: BLE001 - permalink is a nicety, the message was sent
        link = None
    return {"id": f"{res['channel']}:{res['ts']}", "url": link}


def post_message(text: str, channel: str | None = None) -> dict:
    try:
        return _post(channel or os.environ["SLACK_CHANNEL_ID"], text)
    except SlackApiError as exc:
        fallback = os.getenv("SLACK_USER_ID_SHREY")
        if exc.response.get("error") in ("channel_not_found", "not_in_channel") and fallback:
            logger.warning("Slack channel unavailable (%s); DMing the fallback user instead", exc.response["error"])
            return _post(fallback, f"(team channel unavailable)\n{text}")
        raise


def send_dm(slack_user_id: str, text: str) -> dict:
    return _post(slack_user_id, text)  # chat.postMessage to a user id opens/uses the DM
