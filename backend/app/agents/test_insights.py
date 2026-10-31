"""Run from backend/: python -m app.agents.test_insights

Seeds the 3 demo meetings (cached extractions, real embeddings) into the runtime in-memory store,
then exercises the brief, commitments, ledger and digest endpoints through a TestClient.
"""
import json
import sys
import uuid

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.agents import api_insights, api_proposals, runtime
from app.agents.api_dev import MEETINGS, SEED
from app.agents.graphs.ingest import resume_run, start_run

TODAY = "2026-10-31"
AGENDA = "pricing and launch date, plus the OTP bug"


async def seed() -> None:
    runtime.reset()
    store, graph = runtime.get_store(), runtime.get_ingest_graph()
    for n, title, held_at in MEETINGS:
        meeting_id = store.load_seed_meeting(SEED / f"meeting{n}.txt", title, held_at)
        run_id = str(uuid.uuid4())
        pending = await start_run(graph, meeting_id, run_id, True, str(SEED / "extractions" / f"meeting{n}.json"))
        if n != MEETINGS[-1][0]:  # earlier meetings were handled back then
            approve = [{"action": "approve", "proposal_ids": [p["id"] for p in pending],
                        "to": None, "date": None, "text": None}]
            await resume_run(graph, run_id, approve)


def topic_of(brief: dict, *words: str) -> dict | None:
    return next((t for t in brief["topics"] if all(w in t["topic"].lower() for w in words)), None)


def show(title: str, data) -> None:
    print(f"\n===== {title} =====")
    print(json.dumps(data, indent=2, ensure_ascii=False) if not isinstance(data, str) else data)


def main() -> None:
    # One event loop for seeding and requests: the cached async OpenAI client is bound to its loop.
    client = TestClient(_app()).__enter__()
    client.portal.call(seed)
    results: list[tuple[str, bool]] = []

    def check(name: str, ok) -> None:
        results.append((name, bool(ok)))

    # ---- brief ----
    r = client.post("/briefs", json={"agenda": AGENDA, "meeting_at": "2026-11-03T10:00:00"})
    brief = r.json()
    show("Brief", {k: brief[k] for k in ("id", "headline")})
    for t in brief["topics"]:
        print(f"\n  [{t['topic']}] current: {t['current_decision']}")
        for h in t["history"]:
            print(f"     {h['date']} {h['meeting_title']}: {h['statement']}")
        for label in ("open_conflicts", "unresolved", "suggested_questions"):
            for line in t[label]:
                print(f"     {label}: {line}")
        for task in t["open_tasks"]:
            print(f"     task: {task}")
    launch, pricing, otp = topic_of(brief, "launch"), topic_of(brief, "pric"), topic_of(brief, "otp")
    check("POST /briefs returns 200 with an id", r.status_code == 200 and "id" in brief)
    check("brief has one section per agenda topic (3)", len(brief["topics"]) == 3)
    hist = launch["history"] if launch else []
    check("launch date history: Nov 15 -> Nov 30, oldest first",
          len(hist) >= 2 and "15" in hist[0]["statement"] and "30" in hist[-1]["statement"]
          and hist[0]["date"] < hist[-1]["date"])
    hist = pricing["history"] if pricing else []
    check("pricing history: 1,499/1,500 -> 999",
          len(hist) >= 2 and any(x in hist[0]["statement"] for x in ("1,499", "1499", "1,500", "1500"))
          and "999" in hist[-1]["statement"])
    check("OTP bug shows up as unresolved / no owner", otp is not None and (
        any("owner" in u.lower() or "nobody" in u.lower() or "unassigned" in u.lower() for u in otp["unresolved"])
        or any(t["owner"] is None for t in otp["open_tasks"])))
    check("every topic has 1-3 suggested questions", all(1 <= len(t["suggested_questions"]) <= 3 for t in brief["topics"]))
    check("GET /briefs lists it, newest first", client.get("/briefs").json()[0]["id"] == brief["id"])
    check("GET /briefs/{id} returns it", client.get(f"/briefs/{brief['id']}").json()["headline"] == brief["headline"])
    check("GET /briefs/999 is 404", client.get("/briefs/999").status_code == 404)

    # ---- commitments ----
    people = client.get("/commitments", params={"today": TODAY}).json()
    show("Commitments", [{k: p[k] for k in ("name", "committed", "completed", "open", "overdue",
                                            "total_rollovers", "follow_through_rate")} for p in people])
    by_name = {p["name"]: p for p in people}
    check("Pragti total_rollovers >= 2", by_name["Pragti"]["total_rollovers"] >= 2)
    check("Rahul's onboarding screens completed", any(
        "onboarding" in t["title"].lower() and t["status"] == "completed" for t in by_name["Rahul"]["tasks"]))
    check("follow_through_rate = completed / committed", all(
        abs(p["follow_through_rate"] - (p["completed"] / p["committed"] if p["committed"] else 0)) < 1e-9
        for p in people))
    api_spec = next(t for t in by_name["Pragti"]["tasks"] if "api" in t["title"].lower())
    check("task history comes from task_updates", len(api_spec["history"]) >= 1)

    # ---- ledger ----
    ledger = client.get("/ledger/decisions").json()
    show("Ledger", [{"topic": g["topic"], "current": g["current"]["statement"], "has_conflict": g["has_conflict"],
                     "history": [(d["held_at"][:10], d["status"], d["statement"]) for d in g["history"]]}
                    for g in ledger])
    by_topic = {g["topic"].lower(): g for g in ledger}
    for topic in ("launch date", "payments provider", "pricing"):
        g = by_topic.get(topic)
        check(f"ledger '{topic}': 2 decisions, has_conflict", g is not None and len(g["history"]) == 2 and g["has_conflict"])
    g = by_topic["launch date"]
    check("ledger marks the older decision superseded", [d["status"] for d in g["history"]] == ["superseded", "current"]
          and g["current"]["id"] == g["history"][-1]["id"])
    check("ledger ?topic= filters", [x["topic"].lower() for x in client.get("/ledger/decisions", params={"topic": "payments"}).json()]
          == ["payments provider"])
    lineage = client.get(f"/ledger/lineage/{g['history'][0]['id']}").json()
    check("lineage: chain of 2 with the conflict between them", len(lineage["chain"]) == 2 and len(lineage["conflicts"]) >= 1)
    check("lineage of unknown decision is 404", client.get("/ledger/lineage/999").status_code == 404)

    # ---- issues / tasks ----
    check("GET /issues?type=missing_owner", client.get("/issues", params={"type": "missing_owner"}).json() != [])
    soon = client.get("/tasks", params={"due_within_days": 30, "today": TODAY}).json()
    check("GET /tasks?due_within_days only returns open tasks with a deadline", soon != [] and all(
        t["status"] != "completed" and t["deadline"] for t in soon))

    # ---- digest ----
    r = client.post("/digests/run", json={"today": TODAY})
    out = r.json()
    emails = [p for p in client.get("/proposals", params={"status": "pending"}).json() if p["kind"] == "email"]
    show("Digest", out)
    for p in emails:
        print(f"\n  To: {p['payload']['to_name']} <{p['payload']['to']}>\n  Subject: {p['payload']['subject']}\n"
              + "\n".join("  | " + ln for ln in p["payload"]["body"].splitlines()))
    store = runtime.get_store()
    with_email = [p for p in store.list_people() if p.get("email")]
    check("digest: one email proposal per person with an email",
          r.status_code == 200 and out["proposals_created"] == len(with_email) == len(emails)
          and sorted(p["payload"]["to"] for p in emails) == sorted(p["email"] for p in with_email))
    check("digest: pending, < 180 words, subject set", all(
        p["status"] == "pending" and len(p["payload"]["body"].split()) < 180 and p["payload"]["subject"] for p in emails))
    pragti = next(p for p in emails if p["payload"]["to_name"] == "Pragti")
    check("digest: Pragti's email mentions the API spec", "api" in pragti["payload"]["body"].lower())
    confirm = client.post("/proposals/confirm", json={"actions": [
        {"action": "approve", "proposal_ids": [pragti["id"]]}]})
    sent = next((p for p in store.get_proposals() if p["id"] == pragti["id"]), {})
    check("digest email goes through /proposals/confirm and is sent (dry-run)",
          confirm.status_code == 200 and sent.get("status") == "sent")

    print("\n===== Checks =====")
    for name, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
    passed = sum(ok for _, ok in results)
    print(f"\n{passed}/{len(results)} checks passed — {'PASS' if passed == len(results) else 'FAIL'}")


def _app() -> FastAPI:
    app = FastAPI()
    app.include_router(api_insights.router)
    app.include_router(api_proposals.router)
    return app


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
