"""Run from backend/: python -m app.agents.test_extraction"""
from pathlib import Path

from app.agents.extract import DEFAULT_PEOPLE, extract_meeting
from app.agents.schemas import Extraction

SEED = Path(__file__).resolve().parents[3] / "seed"
OUT = SEED / "extractions"

MEETINGS = [
    (1, "Launch Kickoff", "2026-10-17"),
    (2, "Launch Sync", "2026-10-24"),
    (3, "Launch Review", "2026-10-31"),
]


def has(text: str | None, *words: str) -> bool:
    t = (text or "").lower()
    return all(w.lower() in t for w in words)


def decision(x: Extraction, *words: str) -> bool:
    return any(has(f"{d.topic} {d.statement}", *words) for d in x.decisions)


def decision_any(x: Extraction, *alts: str) -> bool:
    return any(decision(x, a) for a in alts)


def task(x: Extraction, *words: str, owner="__any__", conf=None) -> bool:
    for a in x.action_items:
        if not has(f"{a.title} {a.source_quote}", *words):
            continue
        if owner != "__any__" and (a.owner or None) != owner:
            if owner is None or not has(a.owner, owner):
                continue
        if conf and a.deadline_confidence != conf:
            continue
        return True
    return False


def report(n: int, x: Extraction) -> None:
    print(f"\n=== Meeting {n} ===")
    print("Decisions:")
    for d in x.decisions:
        print(f"  - {d.topic}: {d.statement}")
    print("Action items:")
    for a in x.action_items:
        print(f"  - {a.title} | {a.owner} | {a.deadline_raw} | {a.deadline_confidence}")
    print("Disagreements:")
    for d in x.disagreements:
        print(f"  - {d.topic} | resolved={d.resolved}")
    print("Open questions:")
    for q in x.open_questions:
        print(f"  - {q.question} ({q.raised_by})")


def checks(n: int, x: Extraction) -> list[tuple[str, bool]]:
    if n == 1:
        return [
            ("decision: launch Nov 15", decision(x, "15") and decision_any(x, "launch")),
            ("decision: Stripe", decision_any(x, "stripe", "shripe")),
            ("decision: pricing 1,499/1,500", decision_any(x, "1499", "1,499", "1500", "1,500")),
            ("task: API spec (Pragti)", task(x, "api", owner="Pragti")),
            ("task: landing page (Shrey Vohra)", task(x, "landing", owner="Shrey Vohra")),
            ("task: onboarding screens (Rahul)", task(x, "onboarding", owner="Rahul")),
        ]
    if n == 2:
        return [
            (
                "unresolved payments disagreement",
                any(
                    not d.resolved and has(f"{d.topic} {d.source_quote}", "pay")
                    or not d.resolved and has(d.topic, "razorpay")
                    or not d.resolved and has(d.topic, "stripe")
                    for d in x.disagreements
                ),
            ),
            ("task: OTP login bug, owner null", task(x, "otp", owner=None)),
            ("task: API spec re-commitment (Pragti)", task(x, "api", owner="Pragti")),
        ]
    return [
        ("decision: launch Nov 30", decision(x, "30") and decision_any(x, "launch")),
        ("decision: Razorpay", decision(x, "razorpay")),
        ("decision: pricing 999", decision(x, "999")),
        ("task: landing page vague", task(x, "landing", conf="vague")),
        ("task: API spec vague", task(x, "api", conf="vague")),
        ("open question: GST invoices", any(has(q.question, "gst") for q in x.open_questions)),
        ("task: Razorpay integration (Pragti)", task(x, "razorpay", owner="Pragti")),
    ]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total = passed = 0
    for n, title, date in MEETINGS:
        text = (SEED / f"meeting{n}.txt").read_text(encoding="utf-8")
        x = extract_meeting(text, title, date, DEFAULT_PEOPLE)
        (OUT / f"meeting{n}.json").write_text(x.model_dump_json(indent=2), encoding="utf-8")
        report(n, x)
        print("Checks:")
        for name, ok in checks(n, x):
            total += 1
            passed += ok
            print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
    print(f"\n{passed}/{total} checks passed")


if __name__ == "__main__":
    main()
