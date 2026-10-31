"""Confirm flow against a running server (use USE_REAL_INTEGRATIONS=false so nothing is really sent).

  python -m app.agents.test_confirm [http://localhost:8001]
"""
import sys
import time

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001"
c = httpx.Client(base_url=BASE, timeout=300)


def check(label: str, ok: bool) -> bool:
    print(f"[{'PASS' if ok else 'FAIL'}] {label}")
    return ok


def by_id() -> dict:
    return {p["id"]: p for p in c.get("/proposals").json()}


c.post("/dev/reset-supabase").raise_for_status()
meetings = c.get("/meetings").json()
mid = next(m["id"] for m in meetings if m["title"] == "Launch Review")
run = c.post(f"/meetings/{mid}/process").json()["run_id"]
c.get(f"/runs/{run}/stream").read()  # drain until the run pauses at human_review
pending = sorted(p["id"] for p in c.get("/proposals", params={"status": "pending"}).json())
a, b, third = pending[0], pending[1], pending[2]

r1 = c.post("/proposals/confirm", json={"actions": [{"action": "approve", "proposal_ids": [a, b]}]})
s = by_id()
ok = check("confirm #1 and #2 sends both", r1.status_code == 200 and s[a]["status"] == "sent" and s[b]["status"] == "sent")
ext = {i: s[i]["result"]["external_id"] for i in (a, b)}

r2 = c.post("/proposals/confirm", json={"actions": [{"action": "approve", "proposal_ids": [third]}]})
s = by_id()
ok &= check("run already finished, #3 still confirmable (200)", r2.status_code == 200)
ok &= check("#3 sent", s[third]["status"] == "sent")
ok &= check("#1/#2 not re-sent", all(s[i]["result"]["external_id"] == ext[i] for i in (a, b)))

r3 = c.post("/proposals/confirm", json={"actions": [{"action": "approve", "proposal_ids": [a, b]}]})
ok &= check("all already sent -> 409", r3.status_code == 409)

r4 = c.post("/proposals/confirm", json={"actions": [{"action": "reject", "proposal_ids": [pending[3]]},
                                                      {"action": "approve", "proposal_ids": [a, pending[4]]}]})
s = by_id()
ok &= check("mixed batch: reject + approve, sent one untouched", r4.status_code == 200
            and s[pending[3]]["status"] == "rejected" and s[pending[4]]["status"] == "sent"
            and s[a]["result"]["external_id"] == ext[a])
sys.exit(0 if ok else 1)
