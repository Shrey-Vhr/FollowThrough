"""Run from backend/: python -m app.agents.test_task_matching"""
import asyncio
import json
from pathlib import Path

from app.agents.extract import clean_transcript
from app.agents.task_matching import find_duplicate_new_item, match_many

SEED = Path(__file__).resolve().parents[3] / "seed"


def _t(title, owner, deadline):
    return {
        "title": title,
        "owner": owner,
        "deadline_raw": deadline,
        "meeting_title": "Launch Kickoff",
        "meeting_date": "2026-10-17",
    }


OPEN_TASKS = [
    _t("Finish the API spec", "Pragti", "Friday, October 24th"),
    _t("Landing page live", "Shrey Vohra", "October 28th"),
    _t("Design onboarding screens", "Rahul", "October 22nd"),
]

# Against meeting 2: (expected update, substring expected in new_deadline_raw or None)
EXPECTED_M2 = [("recommitted", "27"), ("in_progress", None), ("completed", None)]


def load(n: int) -> tuple[str, list[dict]]:
    text = clean_transcript((SEED / f"meeting{n}.txt").read_text(encoding="utf-8"))
    items = json.loads((SEED / "extractions" / f"meeting{n}.json").read_text(encoding="utf-8"))["action_items"]
    return text, items


async def main() -> None:
    transcript, items = load(2)
    results = await match_many(OPEN_TASKS, transcript, items)

    total = passed = 0
    print("=== Open tasks from M1 vs Meeting 2 ===")
    for task, (want, want_dl), r in zip(OPEN_TASKS, EXPECTED_M2, results):
        ok = r.update == want and (want_dl is None or want_dl in (r.new_deadline_raw or ""))
        total += 1
        passed += ok
        print(
            f"[{'PASS' if ok else 'FAIL'}] {task['title']}: expected={want} got={r.update} "
            f"new_deadline={r.new_deadline_raw!r}\n    quote: {r.quote}"
        )

    print("\n=== find_duplicate_new_item (API spec vs M2 action items) ===")
    idx = find_duplicate_new_item(OPEN_TASKS[0], items)
    print(f"index={idx}" + (f" -> {items[idx]['title']!r}" if idx is not None else ""))
    ok = idx is not None and "api" in items[idx]["title"].lower()
    total += 1
    passed += ok
    print(f"[{'PASS' if ok else 'FAIL'}] duplicate detected for API spec")

    print(f"\n{passed}/{total} checks passed")


if __name__ == "__main__":
    asyncio.run(main())
