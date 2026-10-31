"""Run from backend/: python -m app.agents.test_voice"""
import asyncio
import json

from app.agents.graphs.voice import parse_voice_command

TODAY = "2026-10-31"

PEOPLE = [
    {"id": 1, "name": "Shrey Vohra", "aliases": ["Shrey", "Shrey Vohra (You)"]},
    {"id": 2, "name": "Pragti", "aliases": ["Speaker 2"]},
    {"id": 3, "name": "Rahul", "aliases": []},
]


def _p(pid, kind, **payload):
    # real ids start at 12 (earlier ones are already sent); the user and the LLM see display_no 1..7
    return {"id": pid, "display_no": pid - 11, "kind": kind, "status": "pending", "payload": payload}


PROPOSALS = [
    _p(12, "notion_task", title="Integrate Razorpay", owner="Pragti", due_date="2026-11-20"),
    _p(13, "notion_task", title="Make landing page live", owner="Shrey Vohra", due_date=None),
    _p(14, "slack_message", channel="#tiffinly", text="Nobody owns 'Fix OTP login bug' yet — who can take it?"),
    _p(15, "slack_message", channel="@Pragti", text="Can you confirm a date for 'Finish API spec'?"),
    _p(16, "slack_message", channel="#tiffinly", text="Launch Review summary: 3 conflicts found..."),
    _p(17, "notion_task", title="Fix OTP login bug", owner=None, due_date=None),
    _p(18, "notion_task", title="Write onboarding docs", owner="Rahul", due_date="2026-11-12"),
]


def ids(result, kind):
    return sorted({i for a in result["actions"] if a["action"] == kind for i in a["proposal_ids"]})


def has(result, kind, pid, **fields):
    return any(
        a["action"] == kind and a["proposal_ids"] == [pid] and all(a[k] == v for k, v in fields.items())
        for a in result["actions"]
    )


CASES = [
    ("Approve all the tasks", lambda r: ids(r, "approve") == [12, 13, 17, 18]),
    (
        "Approve everything except the summary",
        lambda r: ids(r, "approve") == [12, 13, 14, 15, 17, 18] and not ids(r, "reject"),
    ),
    (
        "Give the OTP bug to Pragti, due November 10th, and approve it",
        lambda r: ids(r, "approve") == [17]
        and has(r, "reassign", 17, to="Pragti")
        and has(r, "set_deadline", 17, date="2026-11-10"),
    ),
    ("Approve won and two, reject five", lambda r: ids(r, "approve") == [12, 13] and ids(r, "reject") == [16]),
    (
        "Set the landing page deadline to next Friday and approve it",
        lambda r: ids(r, "approve") == [13] and has(r, "set_deadline", 13, date="2026-11-06"),
    ),
    (
        "Assign the landing page to Rohit",
        lambda r: not ids(r, "reassign") and any("Rohit" in w for w in r["warnings"]),
    ),
]


async def main() -> None:
    passed = 0
    for command, check in CASES:
        r = await parse_voice_command(command, PROPOSALS, PEOPLE, today=TODAY)
        ok = bool(check(r))
        passed += ok
        print(f"\n[{'PASS' if ok else 'FAIL'}] {command}")
        print("  actions :", json.dumps(r["actions"]))
        print("  preview :", r["preview"])
        print("  warnings:", r["warnings"])
    print(f"\n{passed}/{len(CASES)} passed")


if __name__ == "__main__":
    asyncio.run(main())
