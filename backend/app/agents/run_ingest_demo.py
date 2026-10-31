"""Run from backend/: python -m app.agents.run_ingest_demo [--cache]

Ingests the three seed meetings in order into one InMemoryStore, so memory builds up.
--cache reuses seed/extractions/meeting{n}.json instead of calling the extraction LLM.
"""
import argparse
import asyncio
import sys
import uuid
from pathlib import Path

from app.agents.graphs.ingest import build_ingest_graph
from app.agents.store import InMemoryStore

SEED = Path(__file__).resolve().parents[3] / "seed"

MEETINGS = [
    (1, "Launch Kickoff", "2026-10-17"),
    (2, "Launch Sync", "2026-10-24"),
    (3, "Launch Review", "2026-10-31"),
]


async def run_meeting(graph, store: InMemoryStore, n: int, title: str, date: str, use_cache: bool) -> None:
    meeting_id = store.load_seed_meeting(SEED / f"meeting{n}.txt", title, date)
    print(f"\n===== Meeting {n}: {title} ({date}) =====")
    state = {
        "run_id": str(uuid.uuid4()),
        "meeting_id": meeting_id,
        "use_cache": use_cache,
        "cache_path": str(SEED / "extractions" / f"meeting{n}.json"),
    }
    async for _mode, event in graph.astream(state, stream_mode=["custom"]):
        print(f"  [{event['node']}] {event['message']}")


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
        text = p["payload"].get("text") or p["payload"].get("title")
        print(f"  #{p['id']} [{p['kind']}] {text}".replace("\n", " | "))


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
    graph = build_ingest_graph(store)
    for n, title, date in MEETINGS:
        await run_meeting(graph, store, n, title, date, use_cache)

    print_report(store)
    print("\n===== Checks =====")
    results = checks(store)
    for name, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
    print(f"\n{sum(ok for _, ok in results)}/{len(results)} checks passed")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", action="store_true", help="use cached extractions")
    asyncio.run(main(parser.parse_args().cache))
