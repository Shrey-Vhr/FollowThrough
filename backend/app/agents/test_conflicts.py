"""Run: python -m app.agents.test_conflicts (from backend/)."""
import asyncio

from app.agents.conflicts import classify_many, is_conflict


def _d(title, date, topic, statement, made_by, quote):
    return {
        "meeting_title": title,
        "meeting_date": date,
        "topic": topic,
        "statement": statement,
        "made_by": made_by,
        "source_quote": quote,
    }


# (name, new, past, expected relation)
CASES = [
    (
        "launch date change",
        _d("Launch sync", "2025-10-24", "launch date", "Launch is pushed to November 30.", "Shrey Vohra",
           "We're pushing the launch to November 30th."),
        _d("Kickoff", "2025-10-17", "launch date", "Launch on November 15.", "Shrey Vohra",
           "We've decided to launch on November 15th."),
        "supersedes",
    ),
    (
        "payment provider switch",
        _d("Payments review", "2025-10-28", "payments provider", "Switch from Stripe to Razorpay for payments.", "Rahul",
           "We're switching to Razorpay instead of Stripe."),
        _d("Kickoff", "2025-10-17", "payments provider", "Use Stripe for payments.", "Rahul",
           "We'll go with Stripe for payments."),
        "supersedes",
    ),
    (
        "price change",
        _d("Pricing review", "2025-10-30", "pricing", "Monthly plan price changed to 999 rupees instead of 1,499.", "Pragti",
           "We're changing the price to 999 instead of 1,499."),
        _d("Kickoff", "2025-10-17", "pricing", "Monthly plan priced at 1,499 rupees.", "Pragti",
           "We'll go with 1,499 for the monthly plan."),
        "supersedes",
    ),
    (
        "price restated",
        _d("Weekly sync", "2025-10-24", "pricing", "Monthly plan is priced at 1,499 rupees.", "Pragti",
           "So the monthly plan is 1,499."),
        _d("Kickoff", "2025-10-17", "pricing", "Monthly plan priced around 1500 rupees.", "Shrey Vohra",
           "We'll price it around 1500 a month."),
        "consistent",
    ),
    (
        "unrelated topics",
        _d("Weekly sync", "2025-10-24", "beta user target", "Target 50 beta users before launch.", "Shrey Vohra",
           "We're aiming for 50 beta users."),
        _d("Kickoff", "2025-10-17", "payments provider", "Use Stripe for payments.", "Rahul",
           "We'll go with Stripe for payments."),
        "unrelated",
    ),
    (
        "silent contradiction",
        _d("Ops sync", "2025-10-28", "delivery area", "We will deliver across all of India from day one.", "Pragti",
           "We'll deliver pan-India from day one."),
        _d("Kickoff", "2025-10-17", "delivery area", "Launch only in Delhi NCR; no other cities at launch.", "Shrey Vohra",
           "We're launching only in Delhi NCR, nothing else at launch."),
        "contradicts",
    ),
]


async def main() -> None:
    verdicts = await classify_many([(new, past) for _, new, past, _ in CASES])
    passed = 0
    for (name, _, _, expected), v in zip(CASES, verdicts):
        ok = v.relation == expected
        passed += ok
        print(
            f"[{'PASS' if ok else 'FAIL'}] {name}: expected={expected} got={v.relation} "
            f"conf={v.confidence:.2f} conflict={is_conflict(v)}\n    {v.explanation}"
        )
    print(f"\n{passed}/{len(CASES)} passed")


if __name__ == "__main__":
    asyncio.run(main())
