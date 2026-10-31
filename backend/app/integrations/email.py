"""Email via Resend. The onboarding sender can only deliver to the account owner, so
RESEND_TEST_RECIPIENT (if set) redirects every message there."""
import os

import resend


def send_email(to: str, subject: str, body: str) -> dict:
    resend.api_key = os.environ["RESEND_API_KEY"]
    override = os.getenv("RESEND_TEST_RECIPIENT")
    if override and override != to:
        subject, body = f"[to: {to}] {subject}", f"(redirected from {to})\n\n{body}"
        to = override
    res = resend.Emails.send({
        "from": os.getenv("RESEND_FROM", "FollowThrough <onboarding@resend.dev>"),
        "to": [to],
        "subject": subject,
        "text": body,
    })
    return {"id": res["id"], "url": None}
