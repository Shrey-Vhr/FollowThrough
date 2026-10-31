from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents import runtime
from app.db.client import get_db

router = APIRouter(prefix="/issues", tags=["issues"])


class IssuePatch(BaseModel):
    action: Literal["supersede", "keep", "flag"]


@router.patch("/{issue_id}")
def patch_issue(issue_id: str, body: IssuePatch):
    store = runtime.get_store()
    issue = next((i for i in store.list_issues() if str(i["id"]) == issue_id), None)
    if issue is None:
        raise HTTPException(404, "Issue not found")
    if body.action == "supersede":
        old, new = issue.get("related_decision_id"), issue.get("decision_id")
        if not (old and new):
            raise HTTPException(400, "This issue has no decision pair to supersede")
        get_db().table("decisions").update({"status": "superseded", "superseded_by": new}).eq("id", old).execute()
        fields = {"status": "resolved", "resolved_by_decision_id": new}
    elif body.action == "keep":
        fields = {"status": "resolved"}
    else:
        fields = {"status": "flagged"}
    store.update_issue(issue["id"], fields)
    return next(i for i in store.list_issues() if str(i["id"]) == issue_id)
