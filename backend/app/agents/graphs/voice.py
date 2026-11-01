"""Graph 2: Voice Command Parser.

parse -> normalize -> validate -> preview -> END

Turns a dictated command into review actions (see review.py) plus a preview sentence.
Nothing is executed here: the actions are only proposed, and the user confirms them in the UI.
"""
import difflib
import re
from datetime import date, datetime
from typing import TypedDict

import dateparser
from langgraph.graph import END, START, StateGraph

from app.agents.llm import get_structured_model
from app.agents.prompts import build_voice_messages
from app.agents.review import preview_actions, summarize_proposal
from app.agents.schemas import VoiceCommandResult
from app.agents.store import match_person

NAME_CUTOFF = 0.75


class VoiceState(TypedDict, total=False):
    command: str
    today: str
    proposals: list[dict]
    numbering: dict[int, int]  # proposal id -> number shown to the user (display_no)
    people: list[dict]
    raw_actions: list[dict]
    actions: list[dict]
    warnings: list[str]
    preview: str


def _ids(ids: list[int], numbering: dict[int, int] | None = None) -> str:
    """'#1, #2' using the numbers the user sees."""
    numbering = numbering or {}
    return ", ".join(f"#{numbering.get(i, i)}" for i in ids)


async def parse(state: VoiceState) -> dict:
    numbering = state["numbering"]
    lines = [f"{numbering[p['id']]}. {summarize_proposal(p)}" for p in state["proposals"]]
    messages = build_voice_messages(state["command"], state["today"], lines, state["people"])
    result: VoiceCommandResult = await get_structured_model(VoiceCommandResult).ainvoke(messages)
    return {"raw_actions": [a.model_dump() for a in result.actions]}


def _canonical_person(name: str, people: list[dict]) -> str | None:
    person = match_person(name, people)
    if person:
        return person["name"]
    names = {n.lower(): p["name"] for p in people for n in [p["name"], *p.get("aliases", [])]}
    close = difflib.get_close_matches(name.strip().lower(), list(names), n=1, cutoff=NAME_CUTOFF)
    return names[close[0]] if close else None


def _to_iso(raw: str, today: str) -> str | None:
    base = datetime.fromisoformat(today)
    # dateparser rejects "next Friday" / "this Friday" but reads a bare weekday as the next one.
    raw = re.sub(r"^\s*(?:by\s+)?(?:(?:next|this|coming)\s+)?(?=(?:mon|tues|wednes|thurs|fri|satur|sun)day\b)", "", raw, flags=re.IGNORECASE)
    parsed = dateparser.parse(raw, settings={"RELATIVE_BASE": base, "PREFER_DATES_FROM": "future"})
    return parsed.date().isoformat() if parsed else None


def normalize(state: VoiceState) -> dict:
    by_number = {n: pid for pid, n in state["numbering"].items()}  # the LLM speaks display numbers
    warnings = list(state.get("warnings", []))
    cleaned: list[dict] = []
    for raw in state["raw_actions"]:
        kind = raw["action"]
        ids = list(dict.fromkeys(raw.get("proposal_ids") or []))
        missing = [i for i in ids if i not in by_number]
        if missing:
            warnings.append(f"There is no proposal {_ids(missing)}.")
        ids = [by_number[i] for i in ids if i in by_number]
        if not ids:
            continue
        a = {"action": kind, "proposal_ids": ids, "to": None, "date": None, "text": None}
        if kind == "reassign":
            name = _canonical_person(raw.get("to") or "", state["people"])
            if not name:
                warnings.append(f"I don't know who '{raw.get('to')}' is, so I didn't reassign.")
                continue
            a["to"] = name
        elif kind == "set_deadline":
            iso = _to_iso(raw["date"], state["today"]) if raw.get("date") else None
            if not iso:
                warnings.append(f"I couldn't understand the date '{raw.get('date')}', so I didn't set a deadline.")
                continue
            a["date"] = iso
        elif kind == "edit_text":
            if raw.get("text") is None:
                continue
            a["text"] = raw["text"]
        cleaned.append(a)

    merged: dict[tuple, dict] = {}
    for a in cleaned:
        key = (a["action"], a["to"], a["date"], a["text"])
        if key in merged:
            ids = merged[key]["proposal_ids"]
            ids += [i for i in a["proposal_ids"] if i not in ids]
        else:
            merged[key] = a
    actions = list(merged.values())
    for a in actions:
        a["proposal_ids"].sort()
    return {"actions": actions, "warnings": warnings}


def validate(state: VoiceState) -> dict:
    warnings = list(state["warnings"])
    actions = [dict(a, proposal_ids=list(a["proposal_ids"])) for a in state["actions"]]
    kinds = {p["id"]: p["kind"] for p in state["proposals"]}

    rejected = {i for a in actions if a["action"] == "reject" for i in a["proposal_ids"]}
    both = sorted({i for a in actions if a["action"] == "approve" for i in a["proposal_ids"] if i in rejected})
    if both:
        for a in actions:
            if a["action"] == "approve":
                a["proposal_ids"] = [i for i in a["proposal_ids"] if i not in rejected]
        actions = [a for a in actions if a["proposal_ids"]]
        warnings.append(f"{_ids(both, state['numbering'])} was both approved and rejected; I kept reject.")

    for a in actions:
        if a["action"] in ("reassign", "set_deadline"):
            off = [i for i in a["proposal_ids"] if kinds.get(i) != "notion_task"]
            if off:
                warnings.append(f"{a['action']} only applies to tasks, but {_ids(off, state['numbering'])} is not a task.")
    return {"actions": actions, "warnings": warnings}


def preview(state: VoiceState) -> dict:
    text = preview_actions(state["proposals"], state["actions"], state["numbering"])
    notes = " ".join(f"Note: {w}" for w in state["warnings"])
    return {"preview": f"{text} {notes}".strip()}


def build_voice_graph():
    g = StateGraph(VoiceState)
    g.add_node("parse", parse)
    g.add_node("normalize", normalize)
    g.add_node("validate", validate)
    g.add_node("preview", preview)
    g.add_edge(START, "parse")
    g.add_edge("parse", "normalize")
    g.add_edge("normalize", "validate")
    g.add_edge("validate", "preview")
    g.add_edge("preview", END)
    return g.compile()


_graph = None


async def parse_voice_command(
    command: str, proposals: list[dict], people: list[dict], today: str | None = None
) -> dict:
    """Parse a dictated command into {"actions", "preview", "warnings"}. Executes nothing.

    The LLM sees each proposal's `display_no` (default: 1..N in id order); actions and the
    returned proposal_ids use the real proposal ids."""
    proposals = sorted(proposals, key=lambda p: p["id"])
    numbering = {p["id"]: p.get("display_no") or n for n, p in enumerate(proposals, 1)}
    global _graph
    _graph = _graph or build_voice_graph()
    out = await _graph.ainvoke(
        {
            "command": command,
            "today": today or date.today().isoformat(),
            "proposals": proposals,
            "numbering": numbering,
            "people": people,
            "warnings": [],
        }
    )
    return {"actions": out["actions"], "preview": out["preview"], "warnings": out["warnings"]}
