"""Run from backend/: python -m app.agents.smoke_test"""
import math

from app.agents.llm import embed_texts, get_structured_model
from app.agents.schemas import Extraction

TRANSCRIPT = """Shrey: We've decided the public beta launches on November 15th.
Pragti: I'll finish the API spec by Friday, October 24th.
Shrey: The landing page will be live soon.
Pragti: Someone needs to fix the OTP login bug.
Shrey: I'm not convinced about Razorpay yet, let's take it offline."""


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))


def main() -> None:
    vecs = embed_texts(["public beta launch date", "when do we release the beta"])
    print("vector length:", len(vecs[0]))
    print("cosine similarity:", round(cosine(vecs[0], vecs[1]), 4))

    result = get_structured_model(Extraction).invoke(
        "Extract decisions, action items, disagreements and open questions "
        "from this meeting transcript:\n\n" + TRANSCRIPT
    )
    print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
