import math

from app.agents.llm import embed_texts, get_structured_model
from app.agents.prompts import build_task_match_messages
from app.agents.schemas import TaskUpdateMatch

DUPLICATE_THRESHOLD = 0.75


def match_task(
    open_task: dict, transcript: str, new_action_items: list[dict]
) -> TaskUpdateMatch:
    messages = build_task_match_messages(open_task, transcript, new_action_items)
    return get_structured_model(TaskUpdateMatch).invoke(messages)


async def match_many(
    open_tasks: list[dict], transcript: str, new_action_items: list[dict]
) -> list[TaskUpdateMatch]:
    if not open_tasks:
        return []
    batches = [
        build_task_match_messages(t, transcript, new_action_items) for t in open_tasks
    ]
    return await get_structured_model(TaskUpdateMatch).abatch(
        batches, config={"max_concurrency": 5}
    )


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def _norm_owner(owner: str | None) -> str | None:
    return owner.strip().lower() if owner and owner.strip() else None


def find_duplicate_new_item(open_task: dict, new_action_items: list[dict]) -> int | None:
    """Index of the new action item that re-promises open_task (same owner, similar title)."""
    owner = _norm_owner(open_task.get("owner"))
    candidates = [
        i for i, a in enumerate(new_action_items) if _norm_owner(a.get("owner")) == owner
    ]
    if not candidates:
        return None
    vectors = embed_texts(
        [open_task["title"]] + [new_action_items[i]["title"] for i in candidates]
    )
    task_vec, item_vecs = vectors[0], vectors[1:]
    best_idx, best_sim = None, DUPLICATE_THRESHOLD
    for i, vec in zip(candidates, item_vecs):
        sim = _cosine(task_vec, vec)
        if sim >= best_sim:
            best_idx, best_sim = i, sim
    return best_idx
