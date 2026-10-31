"""Run from backend/: python -m app.agents.run_ingest_demo [--cache]

Ingests the three seed meetings in order into one InMemoryStore, so memory builds up.
--cache reuses seed/extractions/meeting{n}.json instead of calling the extraction LLM.
"""
import argparse
import asyncio
import logging
import sys
import uuid
from pathlib import Path

from app.agents.graphs.ingest import IngestNodes, build_ingest_graph, dry_run_executor, resume_run, start_run
from app.agents.review import preview_actions
from app.agents.store import InMemoryStore

SEED = Path(__file__).resolve().parents[3] / "seed"

MEETINGS = [
    (1, "Launch Kickoff", "2026-10-17"),
    (2, "Launch Sync", "2026-10-24"),
    (3, "Launch Review", "2026-10-31"),
]


def show_event(event: dict) -> None:
    print(f"  [{event['node']}] {event['message']}")


def proposal_text(p: dict) -> str:
    return (p["payload"].get("text") or p["payload"].get("title")).replace("\n", " | ")


async def run_meeting(graph, store: InMemoryStore, n: int, title: str, date: str, use_cache: bool):
    """Ingest one meeting up to the approval pause -> (run_id, pending proposals)."""
    meeting_id = store.load_seed_meeting(SEED / f"meeting{n}.txt", title, date)
    print(f"\n===== Meeting {n}: {title} ({date}) =====")
    run_id = str(uuid.uuid4())
    cache_path = str(SEED / "extractions" / f"meeting{n}.json")
    pending = await start_run(graph, meeting_id, run_id, use_cache, cache_path, on_event=show_event)
    return run_id, pending


def sample_actions(pending: list[dict]) -> list[dict]:
    """Approve every notion_task, reassign the OTP-bug proposal, reject the meeting summary."""
    tasks = [p["id"] for p in pending if p["kind"] == "notion_task"]
    otp = [p["id"] for p in pending if p["kind"] == "slack_message" and "otp" in p["payload"]["text"].lower()]
    summary = [p["id"] for p in pending if p["kind"] == "slack_message" and p["payload"]["text"].startswith("Summary of")]
    return [
        {"action": "approve", "proposal_ids": tasks, "to": None, "date": None, "text": None},
        {"action": "reassign", "proposal_ids": otp, "to": "Pragti", "date": None, "text": None},
        {"action": "set_deadline", "proposal_ids": otp, "to": None, "date": "2026-11-10", "text": None},
        {"action": "reject", "proposal_ids": summary, "to": None, "date": None, "text": None},
    ]


async def review_meeting3(graph, store: InMemoryStore, executor, run_id: str, pending: list[dict]) -> list[tuple[str, bool]]:
    print("\n===== Paused for approval — pending proposals =====")
    for p in pending:
        print(f"  #{p['id']} [{p['kind']}] {proposal_text(p)}")
    paused_ok = executor.calls == [] and not store.get_proposals(run_id, "sent")
    print(f"  executor calls so far: {len(executor.calls)}")

    actions = sample_actions(pending)
    print(f"\n  Preview: {preview_actions(pending, actions)}")
    final = await resume_run(graph, run_id, actions, on_event=show_event)

    print("\n===== Final statuses =====")
    for p in final:
        print(f"  #{p['id']} {p['status']:<9} [{p['kind']}] {proposal_text(p)[:70]}")
    by_id = {p["id"]: p for p in final}
    tasks = [p for p in final if p["kind"] == "notion_task"]
    otp = next(p for p in final if p["kind"] == "slack_message" and "otp" in p["payload"]["text"].lower())
    summary = next(p for p in final if p["payload"].get("text", "").startswith("Summary of"))
    sent_ids = [p["id"] for p in final if p["status"] == "sent"]
    calls_after = list(executor.calls)

    # a second resume, and a second pass of execute, must not execute anything again
    await resume_run(graph, run_id, actions)
    again = await IngestNodes(store, executor).execute({"run_id": run_id})
    return [
        ("run paused before execute (nothing sent, executor never called)", paused_ok),
        ("approved notion_tasks are sent (dry-run)", bool(tasks) and all(
            p["status"] == "sent" and p["result"]["external_id"] == f"dry-run-{p['id']}" for p in tasks)),
        ("OTP proposal reassigned to Pragti, due 2026-11-10, still pending", (
            otp["status"] == "pending" and otp["payload"]["owner"] == "Pragti"
            and otp["payload"]["due_date"] == "2026-11-10")),
        ("meeting-summary message is rejected", summary["status"] == "rejected"),
        ("only approved proposals were executed", sorted(calls_after) == sorted(sent_ids)),
        ("resume_run again executes nothing twice", executor.calls == calls_after and len(set(executor.calls)) == len(executor.calls)),
        ("execute node re-run skips already-sent proposals", executor.calls == calls_after and again["proposals"] == store.get_proposals(run_id)),
        ("final proposals returned match the store", all(by_id[p["id"]]["status"] == p["status"] for p in store.get_proposals(run_id))),
    ]


class CountingExecutor:
    """dry_run_executor that remembers which proposals it was asked to send."""

    def __init__(self):
        self.calls: list[int] = []

    def __call__(self, proposal: dict) -> dict:
        self.calls.append(proposal["id"])
        return dry_run_executor(proposal)


# ---- report ------------------------------------------------------------

def print_report(store: InMemoryStore) -> None:
    print("\n===== Conflicts =====")
    for i in store.issues.values():
        if i["type"] == "conflict":
            print(f"  - {i['title']}  (confidence {i['details']['confidence']:.2f})")

    print("\n===== Tasks =====")
    print(f"  {'id':<3} {'status':<12} {'roll':<4} {'owner':<12} {'deadline':<11} title")
    for t in store.tasks.values():
        print(
            f"  {t['id']:<3} {t['status']:<12} {t['rollover_count']:<4} {str(t['owner']):<12} "
            f"{str(t['deadline']):<11} {t['title']}"
        )

    print("\n===== Open issues by type =====")
    for issue_type in ("conflict", "vague_deadline", "missing_owner", "disagreement"):
        rows = store.get_open_issues(issue_type)
        print(f"  {issue_type} ({len(rows)})")
        for r in rows:
            print(f"    - {r['title']}")

    print("\n===== Proposals =====")
    for p in store.proposals:
        print(f"  #{p['id']} {p['status']:<8} [{p['kind']}] {proposal_text(p)}")


def _has(text: str, *words: str) -> bool:
    return all(w in text.lower() for w in words)


def checks(store: InMemoryStore) -> list[tuple[str, bool]]:
    issues = list(store.issues.values())
    tasks = list(store.tasks.values())
    conflicts = [i for i in issues if i["type"] == "conflict"]
    conflict_topics = " ".join(i["details"]["new"]["topic"].lower() for i in conflicts)

    def task_issues(issue_type: str, *words: str) -> bool:
        return any(
            _has(i["details"]["task_title"], *words)
            for i in store.get_open_issues(issue_type)
        )

    return [
        (
            "3 conflicts: launch date, payments, pricing",
            len(conflicts) == 3
            and all(w in conflict_topics for w in ("launch", "payment", "pric")),
        ),
        ("API spec rollover_count == 2", any(_has(t["title"], "api spec") and t["rollover_count"] == 2 for t in tasks)),
        ("onboarding screens completed", any(
            _has(t["title"], "onboarding") and t["owner"] == "Rahul" and t["status"] == "completed" for t in tasks)),
        ("vague_deadline: landing page", task_issues("vague_deadline", "landing")),
        ("vague_deadline: API spec", task_issues("vague_deadline", "api spec")),
        ("missing_owner: OTP login bug", task_issues("missing_owner", "otp")),
        ("payments disagreement (M2) resolved", any(
            i["type"] == "disagreement" and _has(i["details"]["topic"], "payment") and i["status"] == "resolved"
            for i in issues)),
    ]


async def main(use_cache: bool) -> None:
    store = InMemoryStore()
    executor = CountingExecutor()
    graph = build_ingest_graph(store, executor=executor)
    review_results: list[tuple[str, bool]] = []
    for n, title, date in MEETINGS:
        run_id, pending = await run_meeting(graph, store, n, title, date, use_cache)
        if n == MEETINGS[-1][0]:
            review_results = await review_meeting3(graph, store, executor, run_id, pending)
        else:  # earlier meetings: nothing to approve in the demo, leave their proposals pending
            await resume_run(graph, run_id, [], on_event=show_event)

    print_report(store)
    print("\n===== Checks =====")
    results = checks(store) + review_results
    for name, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
    print(f"\n{sum(ok for _, ok in results)}/{len(results)} checks passed")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="    %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", action="store_true", help="use cached extractions")
    asyncio.run(main(parser.parse_args().cache))
