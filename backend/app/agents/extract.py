from app.agents.llm import get_structured_model
from app.agents.prompts import build_extraction_messages
from app.agents.schemas import Extraction

DEFAULT_PEOPLE = [
    {"name": "Shrey Vohra", "aliases": ["Shrey", "Shrey Vohra"], "email": "shrey@example.com"},
    {"name": "Pragti", "aliases": ["Pragti", "Pragti Aggarwal", "Speaker 2"], "email": "pragti@example.com"},
    {"name": "Rahul", "aliases": ["Rahul"], "email": "rahul@example.com"},
]


def clean_transcript(transcript: str) -> str:
    """Drop marker lines starting with '<<<' and ending with '>>>'."""
    lines = [
        ln
        for ln in transcript.splitlines()
        if not (ln.strip().startswith("<<<") and ln.strip().endswith(">>>"))
    ]
    return "\n".join(lines).strip()


def extract_meeting(
    transcript: str,
    meeting_title: str,
    meeting_date: str,
    people: list[dict] | None = None,
) -> Extraction:
    messages = build_extraction_messages(
        clean_transcript(transcript),
        meeting_title,
        meeting_date,
        people or DEFAULT_PEOPLE,
    )
    return get_structured_model(Extraction).invoke(messages)
