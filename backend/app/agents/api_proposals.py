"""HTTP API for the Review Queue: list, edit, voice-parse and confirm proposals."""
import asyncio
from collections import defaultdict
from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.agents import runtime
from app.agents.graphs.digest import DIGEST_RUN_PREFIX, confirm_digest_run
from app.agents.graphs.ingest import resume_run
from app.agents.graphs.voice import parse_voice_command
from app.agents.review import preview_actions, summarize_proposal

router = APIRouter(prefix="/proposals", tags=["proposals"])

EDITABLE_STATUSES = {"pending", "rejected"}
DONE_STATUSES = {"sent", "rejected", "superseded"}
_confirm_lock = asyncio.Lock()  # two concurrent confirms must not resume the same run twice


class ProposalOut(BaseModel):
    model_config = ConfigDict(extra="allow")  # rows from the store pass through untouched
    id: int
    run_id: str | None = None
    kind: str
    status: str
    payload: dict[str, Any]
    summary: str
    display_no: int | None = None  # 1..N among pending proposals, in id order; what the user sees


class ProposalPatch(BaseModel):
    payload: dict[str, Any] | None = None
    status: Literal["rejected", "pending"] | None = None


class VoiceCommandIn(BaseModel):
    text: str = Field(min_length=1)


class ReviewAction(BaseModel):
    action: Literal["approve", "reject", "reassign", "set_deadline", "edit_text"]
    proposal_ids: list[int]
    to: str | None = None
    date: str | None = None
    text: str | None = None

    @field_validator("date")
    @classmethod
    def _iso_date(cls, v: str | None) -> str | None:
        if v is not None:
            date.fromisoformat(v)  # ValueError -> 422
        return v


class VoiceCommandOut(BaseModel):
    actions: list[dict[str, Any]]
    preview: str
    warnings: list[str]


class ConfirmIn(BaseModel):
    actions: list[ReviewAction]


class ConfirmOut(BaseModel):
    proposals: list[ProposalOut]
    preview: str


def _with_summary(p: dict) -> dict:
    return {**p, "summary": summarize_proposal(p)}


def _numbering() -> dict[int, int]:
    """proposal id -> display_no, over ALL pending proposals so numbers match the voice parser."""
    return {p["id"]: n for n, p in enumerate(_all_sorted(status="pending"), 1)}


def _all_sorted(**filters) -> list[dict]:
    return sorted(runtime.get_store().get_proposals(**filters), key=lambda p: p["id"])


@router.get("", response_model=list[ProposalOut])
def list_proposals(status: str | None = None, run_id: str | None = None):
    numbers = _numbering()
    return [
        {**_with_summary(p), "display_no": numbers.get(p["id"])}
        for p in _all_sorted(run_id=run_id, status=status)
    ]


@router.patch("/{proposal_id}", response_model=ProposalOut)
def edit_proposal(proposal_id: int, body: ProposalPatch):
    if body.payload is None and body.status is None:
        raise HTTPException(400, "Send a payload and/or a status.")
    store = runtime.get_store()
    current = next((p for p in _all_sorted() if p["id"] == proposal_id), None)
    if current is None:
        raise HTTPException(404, f"No proposal {proposal_id}.")
    if current["status"] not in EDITABLE_STATUSES:
        raise HTTPException(409, f"Proposal {proposal_id} is already {current['status']} and can't be edited.")
    fields: dict[str, Any] = {}
    if body.payload is not None:
        fields["payload"] = {**current["payload"], **body.payload}
    if body.status is not None:
        fields["status"] = body.status
    store.update_proposal(proposal_id, fields)
    return _with_summary(next(p for p in _all_sorted() if p["id"] == proposal_id))


@router.post("/voice-command", response_model=VoiceCommandOut)
async def voice_command(body: VoiceCommandIn):
    """Parse a dictated command into review actions. Nothing is executed."""
    store = runtime.get_store()
    pending = sorted(store.get_proposals(status="pending"), key=lambda p: p["id"])
    if not pending:
        raise HTTPException(400, "There are no pending proposals to act on.")
    numbers = _numbering()
    pending = [{**p, "display_no": numbers[p["id"]]} for p in pending]
    return await parse_voice_command(body.text, pending, store.list_people(), date.today().isoformat())


@router.post("/confirm", response_model=ConfirmOut)
async def confirm(body: ConfirmIn):
    """Apply review actions: resumes each affected run, which then sends what was approved."""
    if not body.actions:
        raise HTTPException(400, "No actions to confirm.")
    actions = [a.model_dump() for a in body.actions]
    async with _confirm_lock:
        everything = {p["id"]: p for p in _all_sorted()}
        referenced = {i for a in actions for i in a["proposal_ids"]}
        unknown = sorted(referenced - everything.keys())
        if unknown:
            raise HTTPException(404, f"No proposal {', '.join(f'#{i}' for i in unknown)}.")

        # Only pending proposals can still change; anything already decided is skipped, which is
        # what makes confirming the same actions twice harmless.
        numbers = _numbering()
        pending = [everything[i] for i in sorted(referenced) if everything[i]["status"] == "pending"]
        by_run: dict[str, list[dict]] = defaultdict(list)
        for p in pending:
            by_run[p["run_id"]].append(p)

        if not pending and referenced and all(everything[i]["status"] in DONE_STATUSES for i in referenced):
            raise HTTPException(409, "Those proposals are already sent, rejected or superseded.")

        graph = runtime.get_ingest_graph()
        for run_id, group in by_run.items():
            ids = {p["id"] for p in group}
            run_actions = [
                {**a, "proposal_ids": [i for i in a["proposal_ids"] if i in ids]}
                for a in actions
                if ids & set(a["proposal_ids"])
            ]
            if run_id.startswith(DIGEST_RUN_PREFIX):  # weekly-digest emails: no paused graph to resume
                await confirm_digest_run(runtime.get_store(), runtime.get_executor(), run_id, run_actions)
                continue
            snapshot = await graph.aget_state({"configurable": {"thread_id": run_id}})
            if snapshot.values and snapshot.next:  # still paused at human_review: resume the graph
                await resume_run(graph, run_id, run_actions)
            else:  # run already finished (or its checkpoint is gone): apply + execute directly
                await confirm_digest_run(runtime.get_store(), runtime.get_executor(), run_id, run_actions)

        updated = {p["id"]: p for p in _all_sorted()}
        return {
            "proposals": [_with_summary(updated[p["id"]]) for p in pending],
            "preview": preview_actions(pending, actions, numbers),
        }
