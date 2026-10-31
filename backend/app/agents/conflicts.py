from app.agents.llm import get_structured_model
from app.agents.prompts import build_conflict_messages
from app.agents.schemas import ConflictVerdict


def classify_conflict(new: dict, past: dict) -> ConflictVerdict:
    messages = build_conflict_messages(new, past)
    return get_structured_model(ConflictVerdict).invoke(messages)


async def classify_many(pairs: list[tuple[dict, dict]]) -> list[ConflictVerdict]:
    if not pairs:
        return []
    batches = [build_conflict_messages(new, past) for new, past in pairs]
    return await get_structured_model(ConflictVerdict).abatch(
        batches, config={"max_concurrency": 5}
    )


def is_conflict(v: ConflictVerdict, threshold: float = 0.7) -> bool:
    return v.relation in ("contradicts", "supersedes") and v.confidence >= threshold
