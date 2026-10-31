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
    return {"id": pid, "kind": kind, "status": "pending", "payload": payload}


PROPOSALS = [
    _p(1, "notion_task", title="Integrate Razorpay", owner="Pragti", due_date="2026-11-20"),
    _p(2, "notion_task", title="Make landing page live", owner="Shrey Vohra", due_date=None),
    _p(3, "slack_message", channel="#tiffinly", text="Nobody owns 'Fix OTP login bug' yet — who can take it?"),
    _p(4, "slack_message", channel="@Pragti", text="Can you confirm a date for 'Finish API spec'?"),
    _p(5, "slack_message", channel="#tiffinly", text="Launch Review summary: 3 conflicts found..."),
    _p(6, "notion_task", title="Fix OTP login bug", owner=None, due_date=None),
]


def ids(result, kind):
    return sorted({i for a in result["actions"] if a["action"] == kind for i in a["proposal_ids"]})


def has(result, kind, pid, **fields):
    return any(
        a["action"] == kind and a["proposal_ids"] == [pid] and all(a[k] == v for k, v in fields.items())
        for a in result["actions"]
    )


CASES = [
    ("Approve all the tasks", lambda r: ids(r, "approve") == [1, 2, 6]),
    (
        "Approve everything except the summary",
        lambda r: ids(r, "approve") == [1, 2, 3, 4, 6] and not ids(r, "reject"),
    ),
    (
        "Give the OTP bug to Pragti, due November 10th, and approve it",
        lambda r: ids(r, "approve") == [6]
        and has(r, "reassign", 6, to="Pragti")
        and has(r, "set_deadline", 6, date="2026-11-10"),
    ),
    ("Approve won and two, reject five", lambda r: ids(r, "approve") == [1, 2] and ids(r, "reject") == [5]),
    (
        "Set the landing page deadline to next Friday and approve it",
        lambda r: ids(r, "approve") == [2] and has(r, "set_deadline", 2, date="2026-11-06"),
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
