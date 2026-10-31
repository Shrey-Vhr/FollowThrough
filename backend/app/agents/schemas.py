"""Pydantic v2 schemas for LLM structured output (OpenAI strict mode: no defaults)."""
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Decision(BaseModel):
    topic: str = Field(description="Short label for the subject of the decision, e.g. 'launch date', 'payments', 'pricing'.")
    statement: str = Field(description="The decision that was made, in one sentence.")
    made_by: Optional[str] = Field(description="Name of the speaker who made or announced the decision; null if unclear.")
    source_quote: str = Field(description="The exact line from the transcript that supports this decision.")
    ts_seconds: Optional[int] = Field(description="Timestamp in seconds from the start of the meeting, if available; otherwise null.")


class ActionItem(BaseModel):
    title: str = Field(description="Short imperative description of the task to be done.")
    owner: Optional[str] = Field(description="Name of the person clearly assigned or who volunteered. Null if nobody was clearly assigned; never guess.")
    deadline_raw: Optional[str] = Field(description="The deadline exactly as spoken, e.g. 'by Friday, October 24th', 'soon', 'next week-ish'. Null if no deadline was mentioned.")
    deadline_confidence: Literal["exact", "inferred", "vague", "none"] = Field(
        description="'exact' for a specific date/day, 'inferred' if a date can be reasonably derived, 'vague' for fuzzy timing like 'soon', 'none' if no deadline."
    )
    source_quote: str = Field(description="The exact line from the transcript that supports this action item.")
    ts_seconds: Optional[int] = Field(description="Timestamp in seconds from the start of the meeting, if available; otherwise null.")


class Position(BaseModel):
    person: str = Field(description="Name of the person holding this position.")
    view: str = Field(description="Their view or stance, in one short sentence.")


class Disagreement(BaseModel):
    topic: str = Field(description="Short label for what the disagreement is about.")
    positions: list[Position] = Field(description="The differing positions taken by participants.")
    resolved: bool = Field(description="True only if the participants reached an explicit resolution in the meeting.")
    source_quote: str = Field(description="The exact line from the transcript that best shows the disagreement.")


class OpenQuestion(BaseModel):
    question: str = Field(description="A question raised in the meeting that was left unanswered.")
    raised_by: Optional[str] = Field(description="Name of the speaker who raised it; null if unclear.")


class Extraction(BaseModel):
    decisions: list[Decision] = Field(description="All decisions made in the meeting.")
    action_items: list[ActionItem] = Field(description="All tasks that someone needs to do, including ones with no owner.")
    disagreements: list[Disagreement] = Field(description="Points where participants expressed differing views or doubt.")
    open_questions: list[OpenQuestion] = Field(description="Questions raised but not answered.")


class ConflictVerdict(BaseModel):
    relation: Literal["contradicts", "supersedes", "consistent", "unrelated"] = Field(
        description="How the new statement relates to the earlier one."
    )
    explanation: str = Field(description="Brief explanation of why this relation was chosen.")
    confidence: float = Field(description="Confidence in the verdict, between 0 and 1.")


class TaskUpdateMatch(BaseModel):
    update: Literal["completed", "in_progress", "blocked", "recommitted", "not_mentioned"] = Field(
        description="What the transcript says about this task's status; 'not_mentioned' if it isn't discussed."
    )
    new_deadline_raw: Optional[str] = Field(description="New deadline exactly as spoken if the task was recommitted; otherwise null.")
    quote: Optional[str] = Field(description="Exact transcript line supporting the update; null if not mentioned.")


class VoiceAction(BaseModel):
    action: Literal["approve", "reject", "reassign", "set_deadline", "edit_text"] = Field(
        description="The operation to perform on the referenced proposals."
    )
    proposal_ids: list[int] = Field(description="IDs of the proposals this action applies to.")
    to: Optional[str] = Field(description="New owner name for 'reassign'; otherwise null.")
    date: Optional[str] = Field(description="Deadline in ISO format yyyy-mm-dd for 'set_deadline'; otherwise null.")
    text: Optional[str] = Field(description="Replacement text for 'edit_text'; otherwise null.")


class VoiceCommandResult(BaseModel):
    actions: list[VoiceAction] = Field(description="The actions parsed from the voice command, in order.")
    preview: str = Field(description="One human-readable sentence describing what will happen.")


class AgendaTopics(BaseModel):
    topics: list[str] = Field(description="1 to 5 short topic phrases (2-4 words each) covered by the agenda, e.g. 'launch date', 'pricing', 'OTP login bug'.")


class BriefHistoryItem(BaseModel):
    date: str = Field(description="Meeting date, yyyy-mm-dd, copied from the facts.")
    meeting_title: str = Field(description="Meeting title, copied from the facts.")
    statement: str = Field(description="What was decided then. Append ' (superseded)' if a later decision replaced it.")


class BriefTask(BaseModel):
    title: str = Field(description="Task title.")
    owner: Optional[str] = Field(description="Owner name, or null if nobody owns it.")
    deadline: Optional[str] = Field(description="Deadline yyyy-mm-dd if known, else the raw wording, else null.")
    status: str = Field(description="Task status copied from the facts.")
    rollover_count: int = Field(description="How many meetings the task has slipped, copied from the facts.")


class BriefTopic(BaseModel):
    topic: str = Field(description="The agenda topic this section covers.")
    current_decision: Optional[str] = Field(description="The decision that stands today, one sentence; null if nothing was decided.")
    history: list[BriefHistoryItem] = Field(description="Past decisions on this topic, oldest first.")
    open_conflicts: list[str] = Field(description="One short sentence per unresolved conflict or disagreement on this topic.")
    open_tasks: list[BriefTask] = Field(description="Tasks on this topic that are not completed.")
    unresolved: list[str] = Field(description="Gaps: tasks with no owner, vague deadlines, open questions. One short sentence each.")
    suggested_questions: list[str] = Field(description="At most 3 concrete questions to ask in the meeting.")


class BriefOut(BaseModel):
    headline: str = Field(description="One sentence: the most important thing to know going into the meeting.")
    topics: list[BriefTopic] = Field(description="One section per agenda topic, in agenda order.")


class DigestEmail(BaseModel):
    subject: str = Field(description="Short email subject line.")
    body: str = Field(description="Plain-text email body, under 180 words, with '- ' bullet points.")
