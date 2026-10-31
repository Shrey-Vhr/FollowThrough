"""Human review of proposals: one action format for both UI buttons and voice commands.

An action is a VoiceAction-shaped dict:
    {"action": "approve|reject|reassign|set_deadline|edit_text",
     "proposal_ids": [1, 2], "to": str | None, "date": "yyyy-mm-dd" | None, "text": str | None}
"""
import re
from copy import deepcopy
from datetime import date

from app.agents.store import Store, match_person

# A proposal that has already left the building can't be reviewed again.
FROZEN_STATUSES = {"sent", "failed", "superseded"}


def _canonical(name: str, people: list[dict]) -> tuple[str, dict | None]:
    person = match_person(name, people)
    return (person["name"], person) if person else (name.strip(), None)


def _names(person: dict) -> list[str]:
    """Name + aliases, longest first so 'Shrey Vohra' is replaced before 'Shrey'."""
    return sorted({person["name"], *person.get("aliases", [])}, key=len, reverse=True)


def _rewrite_owner(text: str, old_owner: str | None, new_name: str, people: list[dict]) -> str:
    """Point @mentions (and the previous owner's name, if known) at the new owner."""
    old = match_person(old_owner, people) if old_owner else None
    for person in people:
        if person["name"] == new_name:
            continue
        for alias in _names(person):
            text = re.sub(rf"@{re.escape(alias)}\b", f"@{new_name}", text, flags=re.IGNORECASE)
    if old and old["name"] != new_name:
        for alias in _names(old):
            text = re.sub(rf"\b{re.escape(alias)}\b", new_name, text, flags=re.IGNORECASE)
    return text


def _reassign(p: dict, to: str, people: list[dict]) -> None:
    payload = p["payload"]
    name, person = _canonical(to, people)
    old_owner = payload.get("owner")
    payload["owner"] = name
    payload["owner_id"] = person["id"] if person else None
    if payload.get("text"):
        payload["text"] = _rewrite_owner(payload["text"], old_owner, name, people)


def _set_deadline(p: dict, iso: str) -> None:
    date.fromisoformat(iso)  # reject non-ISO dates early
    p["payload"]["due_date"] = iso
    if p["kind"] == "notion_task":
        p["payload"]["deadline"] = iso


def _edit_text(p: dict, text: str) -> None:
    p["payload"]["text"] = text
    if p["kind"] == "notion_task":
        p["payload"]["title"] = text
    elif p["kind"] == "email":
        p["payload"]["body"] = text


def apply_review_actions(store: Store, proposals: list[dict], actions: list[dict], people: list[dict]) -> list[dict]:
    """Apply actions in order to `proposals`, persist the changed ones, return the updated list.

    Proposals not mentioned stay as they are (normally "pending"); unknown ids are ignored.
    """
    updated = {p["id"]: deepcopy(p) for p in proposals}
    touched: set[int] = set()
    for a in actions:
        for pid in a.get("proposal_ids", []):
            p = updated.get(pid)
            if p is None or p["status"] in FROZEN_STATUSES:
                continue
            touched.add(pid)
            kind = a["action"]
            if kind == "approve":
                p["status"] = "approved"
            elif kind == "reject":
                p["status"] = "rejected"
            elif kind == "reassign" and a.get("to"):
                _reassign(p, a["to"], people)
            elif kind == "set_deadline" and a.get("date"):
                _set_deadline(p, a["date"])
            elif kind == "edit_text" and a.get("text") is not None:
                _edit_text(p, a["text"])
    for pid in touched:
        store.update_proposal(pid, {"status": updated[pid]["status"], "payload": updated[pid]["payload"]})
    return [updated[p["id"]] for p in proposals]


# ---- preview -----------------------------------------------------------

def _pretty_date(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d:%b} {d.day}"


def _join(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + f" and {items[-1]}"


def preview_actions(proposals: list[dict], actions: list[dict], numbering: dict[int, int] | None = None) -> str:
    """e.g. "Approve #1 (reassigned to Shrey, due Nov 5) and #3. Reject #2. #4 stays pending.".

    `numbering` maps proposal id -> the number shown to the user (display_no); default is the id."""
    numbering = numbering or {}
    known = {p["id"] for p in proposals}
    status: dict[int, str] = {}
    notes: dict[int, dict] = {}
    for a in actions:
        for pid in a.get("proposal_ids", []):
            if pid not in known:
                continue
            kind = a["action"]
            if kind == "approve":
                status[pid] = "approve"
            elif kind == "reject":
                status[pid] = "reject"
            elif kind == "reassign" and a.get("to"):
                notes.setdefault(pid, {})["to"] = a["to"]
            elif kind == "set_deadline" and a.get("date"):
                notes.setdefault(pid, {})["due"] = _pretty_date(a["date"])
            elif kind == "edit_text":
                notes.setdefault(pid, {})["edited"] = True

    def label(pid: int) -> str:
        n = notes.get(pid, {})
        parts = [f"reassigned to {n['to']}"] if "to" in n else []
        parts += [f"due {n['due']}"] if "due" in n else []
        parts += ["text edited"] if n.get("edited") else []
        shown = numbering.get(pid, pid)
        return f"#{shown} ({', '.join(parts)})" if parts else f"#{shown}"

    sentences = []
    for verb, key in (("Approve", "approve"), ("Reject", "reject")):
        ids = [p["id"] for p in proposals if status.get(p["id"]) == key]
        if ids:
            sentences.append(f"{verb} {_join([label(i) for i in ids])}.")
    waiting = [p["id"] for p in proposals if p["id"] not in status and p.get("status", "pending") == "pending"]
    if waiting:
        sentences.append(f"{_join([label(i) for i in waiting])} {'stays' if len(waiting) == 1 else 'stay'} pending.")
    return " ".join(sentences) or "No changes."


def summarize_proposal(p: dict) -> str:
    """One line describing a proposal, for the LLM prompt and the UI."""
    pl = p.get("payload", {})
    kind = p["kind"]
    if kind == "notion_task":
        due = pl.get("due_date") or pl.get("deadline") or "no date"
        return f"Create task: {pl.get('title')} → {pl.get('owner') or 'no owner'}, due {due}"
    if kind == "slack_message":
        target = pl.get("channel") or pl.get("user") or pl.get("to")
        return f"Slack to {target}: {(pl.get('text') or '')[:70]}"
    if kind == "email":
        return f"Email to {pl.get('to')}: {pl.get('subject')}"
    return f"{kind}: {pl}"
