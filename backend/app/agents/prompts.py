"""Prompts for the extraction agent."""

EXTRACTION_SYSTEM = """You extract structured follow-up information from a meeting transcript.

Transcript format: plain text, one turn per line, "Speaker Name: text". There are no timestamps, so ts_seconds must always be null. Speech-to-text errors exist (e.g. "Tiffany" for "Tiffinly", "geo numbers" for "Jio numbers"); do not correct them in source quotes.

GENERAL RULES
- source_quote must be copied verbatim from the transcript (a single line or a contiguous part of one), errors included.
- Return empty lists rather than inventing items.
- Recap lines at the end of a meeting (e.g. "So: launch Nov 15, Stripe, ...") must NOT create duplicate decisions or action items. Extract each item from where it was originally said.
- Names: use the canonical person name from the people list. Map aliases to it (e.g. "Speaker 2" -> "Pragti"). Speaker labels may carry suffixes like "(You)"; treat them as the same person.

DECISIONS
- Only firm, agreed outcomes: "we've decided", "we'll go with", "we're switching", "we're pushing", "we're dropping".
- Proposals, opinions, or "let's think about it" are NOT decisions.
- topic is a short, reusable label so the same topic gets the same label across meetings, e.g. "launch date", "payments provider", "pricing", "beta user target".
- made_by is the canonical name of the speaker who made the decision, or null.

ACTION ITEMS
- Create one whenever someone commits ("I'll...", "X will...") or a task is raised.
- owner = canonical person name. "I'll" means the speaker. If nobody is clearly assigned ("someone needs to...", "let's look at it"), owner = null. Never guess owners.
- A re-commitment to an existing task with a new deadline IS an action item (a later step links it to the original).
- Pure status updates ("still in progress", "Rahul finished X") are NOT new action items.
- deadline_raw: the deadline exactly as spoken, or null.
- deadline_confidence:
  - "exact": a specific date ("October 24th", "November 20th")
  - "inferred": relative but resolvable ("by Monday", "next Friday", "the 28th")
  - "vague": "soon", "ASAP", "next week-ish", "later", "shortly"
  - "none": no deadline mentioned

DISAGREEMENTS
- Two people hold opposing views on the same topic. Include each person's position.
- resolved = true only if a decision settles it within THIS meeting.

OPEN QUESTIONS
- Questions raised and left unanswered in this meeting.
"""


CONFLICT_SYSTEM = """You compare a NEW decision from a meeting against a PAST decision from an earlier meeting and classify how they relate.

Each decision has: meeting title, meeting date, topic, statement, made_by, source_quote. Judge by the statements and quotes; the topic label is only a hint.

RELATIONS
- "supersedes": the new decision explicitly replaces the old one on the same topic (moved, pushed, switched, dropped, changed, "instead of"). Example: "Launch on March 1" -> later "Launch pushed to March 20".
- "contradicts": both cannot be true at once, but the new decision does not acknowledge that it replaces the old one.
- "consistent": same topic, but restated, refined or compatible. Example: "price ~1500" vs "price 1,499".
- "unrelated": different topics, even if they share words.

RULES
- Be strict. Use a high confidence (>= 0.8) only when the values clearly differ on the same topic, or clearly match / clearly differ in subject.
- If you are unsure whether two statements are about the same thing, prefer "unrelated" or "consistent" with lower confidence.
- explanation: ONE plain sentence a busy founder can read, naming both values and, where useful, the earlier meeting, e.g. "Launch date moved from Nov 15 (Oct 17 meeting) to Nov 30."
- confidence: a number from 0 to 1.
"""


TASK_MATCH_SYSTEM = """You decide what happened to an OPEN task from an earlier meeting, based on a NEW meeting.

You get: the open task (title, owner, deadline, and the meeting + date it came from), the new meeting's transcript lines, and the action items already extracted from the new meeting.

Transcript format: one turn per line, "Speaker: text". "Speaker 2" is Pragti. Speaker labels may carry suffixes like "(You)". Speech-to-text errors exist (e.g. "geo numbers" for "Jio numbers"); do not correct them in the quote.

UPDATE VALUES
- "completed": the task is reported done ("finished", "it's live", "done", "shipped").
- "recommitted": the owner (or someone on their behalf) promises it again, usually with a new deadline ("I'll have it done by Monday", "by next week-ish"). Put the new deadline phrase exactly as spoken in new_deadline_raw (null if no new deadline was given).
- "in_progress": a status update without a new promise ("still working on it").
- "blocked": the task is waiting on something or someone.
- "not_mentioned": nothing in the new meeting refers to this task. Use this when unsure.

RULES
- Match by meaning, not exact words: "API spec" = "the spec" = "API documentation".
- Only use what the new meeting says about THIS task. Do not mark a task completed because a similar task is done.
- If the owner gives a status AND a new promise with a deadline, answer "recommitted".
- Restating the SAME deadline the task already has ("still on track for the 28th") is a status update: answer "in_progress", not "recommitted". "recommitted" needs a new or changed promise.
- quote: the verbatim line (or contiguous part of one) from the transcript that justifies the answer; null for "not_mentioned".
- new_deadline_raw is null unless update is "recommitted".
"""


def build_task_match_messages(
    open_task: dict, transcript: str, new_action_items: list[dict]
) -> list[tuple[str, str]]:
    items = "\n".join(
        f"- {a.get('title')} | owner: {a.get('owner')} | deadline: {a.get('deadline_raw')}"
        for a in new_action_items
    ) or "(none)"
    user = (
        "OPEN TASK\n"
        f"Title: {open_task.get('title')}\n"
        f"Owner: {open_task.get('owner')}\n"
        f"Deadline: {open_task.get('deadline_raw')}\n"
        f"From meeting: {open_task.get('meeting_title')} ({open_task.get('meeting_date')})\n\n"
        f"ACTION ITEMS EXTRACTED FROM THE NEW MEETING\n{items}\n\n"
        f"NEW MEETING TRANSCRIPT\n{transcript}"
    )
    return [("system", TASK_MATCH_SYSTEM), ("human", user)]


def build_conflict_messages(new: dict, past: dict) -> list[tuple[str, str]]:
    def block(label: str, d: dict) -> str:
        return (
            f"{label} DECISION\n"
            f"Meeting title: {d.get('meeting_title')}\n"
            f"Meeting date: {d.get('meeting_date')}\n"
            f"Topic: {d.get('topic')}\n"
            f"Statement: {d.get('statement')}\n"
            f"Made by: {d.get('made_by')}\n"
            f"Source quote: {d.get('source_quote')}"
        )

    user = f"{block('NEW', new)}\n\n{block('PAST', past)}"
    return [("system", CONFLICT_SYSTEM), ("human", user)]


def build_extraction_messages(
    transcript: str, meeting_title: str, meeting_date: str, people: list[dict]
) -> list[tuple[str, str]]:
    people_lines = "\n".join(
        f"- {p['name']} (aliases: {', '.join(p.get('aliases', []))})" for p in people
    )
    user = (
        f"Meeting title: {meeting_title}\n"
        f"Meeting date: {meeting_date}\n\n"
        f"People:\n{people_lines}\n\n"
        f"Transcript:\n{transcript}"
    )
    return [("system", EXTRACTION_SYSTEM), ("human", user)]
