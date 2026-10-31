"""Supabase-backed implementation of the agent Store protocol."""

from app.agents.store import match_person
from app.db.client import get_db


MEETING_COLUMNS = "id,title,held_at"
SEGMENT_COLUMNS = "speaker,person_id,text"
TASK_COLUMNS = (
    "id,meeting_id,title,owner_id,deadline_raw,deadline,deadline_confidence,status,"
    "rollover_count,source_quote,ts_seconds,notion_page_id"
)
DECISION_COLUMNS = "id,meeting_id,topic,statement,made_by,made_by_id,source_quote"
ISSUE_COLUMNS = (
    "id,type,severity,title,details,status,meeting_id,decision_id,related_decision_id,"
    "task_id,resolved_by_decision_id,created_at"
)
PROPOSAL_COLUMNS = (
    "id,run_id,meeting_id,kind,payload,status,issue_id,task_id,result,created_at"
)
DECISION_INPUT_COLUMNS = (
    "id,meeting_id,topic,statement,made_by,made_by_id,source_quote,ts_seconds"
)


class SupabaseStore:
    """Persist agent graph reads and writes in Supabase."""

    def __init__(self):
        self.db = get_db()

    def get_meeting(self, meeting_id) -> dict:
        rows = (
            self.db.table("meetings")
            .select(MEETING_COLUMNS)
            .eq("id", meeting_id)
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            raise KeyError(f"no meeting {meeting_id}")
        return rows[0]

    def get_segments(self, meeting_id) -> list[dict]:
        return (
            self.db.table("segments")
            .select(SEGMENT_COLUMNS)
            .eq("meeting_id", meeting_id)
            .order("idx")
            .order("id")
            .execute()
            .data
        )

    def list_people(self) -> list[dict]:
        return self.db.table("people").select("id,name,aliases").execute().data

    def get_open_tasks(self, exclude_meeting_id) -> list[dict]:
        tasks = (
            self.db.table("tasks")
            .select(TASK_COLUMNS)
            .neq("status", "completed")
            .execute()
            .data
        )
        tasks = [task for task in tasks if task["meeting_id"] != exclude_meeting_id]
        if not tasks:
            return []

        people = {person["id"]: person["name"] for person in self.list_people()}
        meeting_ids = list({task["meeting_id"] for task in tasks if task["meeting_id"] is not None})
        meetings = (
            self.db.table("meetings")
            .select("id,title,held_at")
            .in_("id", meeting_ids)
            .execute()
            .data
            if meeting_ids
            else []
        )
        meeting_by_id = {meeting["id"]: meeting for meeting in meetings}

        result = []
        for task in tasks:
            meeting = meeting_by_id.get(task["meeting_id"], {})
            held_at = meeting.get("held_at")
            result.append({
                **task,
                "owner": people.get(task["owner_id"]),
                "meeting_title": meeting.get("title"),
                "meeting_date": held_at[:10] if held_at else None,
            })
        return result

    def match_decisions(self, embedding: list[float], k: int, exclude_meeting_id) -> list[dict]:
        return self._search_decisions("match_decisions", embedding, k, exclude_meeting_id)

    def search_decisions(self, embedding: list[float], k: int, exclude_meeting_id=None) -> list[dict]:
        return self._search_decisions("search_decisions", embedding, k, exclude_meeting_id)

    def _search_decisions(self, function: str, embedding: list[float], k: int, exclude_meeting_id) -> list[dict]:
        matches = self.db.rpc(
            function,
            {"q": embedding, "k": k, "exclude_meeting": exclude_meeting_id},
        ).execute().data
        if not matches:
            return []

        ids = [match["id"] for match in matches]
        decisions = (
            self.db.table("decisions")
            .select(DECISION_COLUMNS)
            .in_("id", ids)
            .execute()
            .data
        )
        decision_by_id = {decision["id"]: decision for decision in decisions}
        people = {person["id"]: person["name"] for person in self.list_people()}
        meeting_ids = list({decision["meeting_id"] for decision in decisions})
        meetings = (
            self.db.table("meetings")
            .select("id,title,held_at")
            .in_("id", meeting_ids)
            .execute()
            .data
        )
        meeting_by_id = {meeting["id"]: meeting for meeting in meetings}

        result = []
        for match in matches:
            decision = decision_by_id.get(match["id"])
            if decision is None:
                continue
            meeting = meeting_by_id.get(decision["meeting_id"], {})
            held_at = meeting.get("held_at")
            made_by_id = decision.get("made_by_id") or decision.get("made_by")
            result.append({
                "id": decision["id"],
                "meeting_id": decision["meeting_id"],
                "topic": decision["topic"],
                "statement": decision["statement"],
                "made_by": people.get(made_by_id),
                "source_quote": decision["source_quote"],
                "similarity": match["similarity"],
                "meeting_title": meeting.get("title"),
                "meeting_date": held_at[:10] if held_at else None,
            })
        return result

    def match_open_tasks(self, embedding: list[float], k: int, exclude_meeting_id=None) -> list[dict]:
        return self._search_tasks("match_open_tasks", embedding, k, exclude_meeting_id)

    def search_tasks(self, embedding: list[float], k: int, exclude_meeting_id=None) -> list[dict]:
        return self._search_tasks("search_tasks", embedding, k, exclude_meeting_id)

    def _search_tasks(self, function: str, embedding: list[float], k: int, exclude_meeting_id) -> list[dict]:
        matches = self.db.rpc(
            function,
            {"q": embedding, "k": k, "exclude_meeting": exclude_meeting_id},
        ).execute().data
        if not matches:
            return []
        tasks = (
            self.db.table("tasks")
            .select(TASK_COLUMNS)
            .in_("id", [match["id"] for match in matches])
            .execute()
            .data
        )
        task_by_id = {task["id"]: task for task in tasks}
        people = {person["id"]: person["name"] for person in self.list_people()}
        meeting_ids = list({task["meeting_id"] for task in tasks if task["meeting_id"] is not None})
        meetings = (
            self.db.table("meetings")
            .select("id,title,held_at")
            .in_("id", meeting_ids)
            .execute()
            .data
            if meeting_ids
            else []
        )
        meeting_by_id = {meeting["id"]: meeting for meeting in meetings}
        result = []
        for match in matches:
            task = task_by_id.get(match["id"])
            if task is None:
                continue
            meeting = meeting_by_id.get(task["meeting_id"], {})
            held_at = meeting.get("held_at")
            result.append({
                **task,
                "owner": people.get(task["owner_id"]),
                "similarity": match["similarity"],
                "meeting_title": meeting.get("title"),
                "meeting_date": held_at[:10] if held_at else None,
            })
        return result

    def save_decisions(self, meeting_id, decisions: list[dict]) -> list[dict]:
        if not decisions:
            return []
        people = self.list_people()
        rows = []
        for decision in decisions:
            person = match_person(decision.get("made_by"), people)
            person_id = decision.get("made_by_id") or (person["id"] if person else None)
            rows.append({
                "meeting_id": meeting_id,
                "topic": decision.get("topic"),
                "statement": decision["statement"],
                "made_by": person_id,
                "made_by_id": person_id,
                "source_quote": decision.get("source_quote"),
                "ts_seconds": decision.get("ts_seconds"),
                "embedding": decision["embedding"],
            })
        inserted = (
            self.db.table("decisions")
            .insert(rows)
            .select(DECISION_INPUT_COLUMNS)
            .execute()
            .data
        )
        return [
            {
                **decision,
                **row,
                "made_by": decision.get("made_by"),
                "made_by_id": decision.get("made_by_id") or row.get("made_by_id"),
                "embedding": decision["embedding"],
            }
            for decision, row in zip(decisions, inserted)
        ]

    def save_tasks(self, meeting_id, tasks: list[dict]) -> list[dict]:
        if not tasks:
            return []
        people = self.list_people()
        people_by_id = {person["id"]: person for person in people}
        rows = []
        owner_names = []
        for task in tasks:
            person = match_person(task.get("owner"), people)
            owner_id = task.get("owner_id") or (person["id"] if person else None)
            owner = people_by_id.get(owner_id) or person
            owner_names.append(owner["name"] if owner else task.get("owner"))
            rows.append({
                "meeting_id": meeting_id,
                "title": task["title"],
                "owner_id": owner_id,
                "deadline_raw": task.get("deadline_raw"),
                "deadline": task.get("deadline"),
                "deadline_confidence": task.get("deadline_confidence"),
                "status": task.get("status", "open"),
                "rollover_count": task.get("rollover_count", 0),
                "source_quote": task.get("source_quote"),
                "embedding": task["embedding"],
            })
        inserted = (
            self.db.table("tasks")
            .insert(rows)
            .select(TASK_COLUMNS)
            .execute()
            .data
        )
        return [
            {**row, "owner": owner}
            for row, owner in zip(inserted, owner_names)
        ]

    def update_task(self, task_id, fields: dict) -> None:
        updated = (
            self.db.table("tasks")
            .update(fields)
            .eq("id", task_id)
            .select("id")
            .execute()
            .data
        )
        if not updated:
            raise KeyError(f"no task {task_id}")

    def save_task_update(self, task_id, meeting_id, update_type: str, quote: str | None) -> None:
        self.db.table("task_updates").insert({
            "task_id": task_id,
            "meeting_id": meeting_id,
            "update_type": update_type,
            "quote": quote,
        }).execute()

    def get_open_issues(self, issue_type: str | None = None) -> list[dict]:
        query = self.db.table("issues").select(ISSUE_COLUMNS).eq("status", "open")
        if issue_type is not None:
            query = query.eq("type", issue_type)
        return query.execute().data

    def save_issue(self, issue: dict) -> dict:
        row = {
            key: issue[key]
            for key in (
                "type", "title", "details", "meeting_id", "decision_id",
                "related_decision_id", "task_id", "status", "severity",
            )
            if key in issue
        }
        row.setdefault("status", "open")
        return (
            self.db.table("issues")
            .insert(row)
            .select(ISSUE_COLUMNS)
            .execute()
            .data[0]
        )

    def update_issue(self, issue_id, fields: dict) -> None:
        updated = (
            self.db.table("issues")
            .update(fields)
            .eq("id", issue_id)
            .select("id")
            .execute()
            .data
        )
        if not updated:
            raise KeyError(f"no issue {issue_id}")

    def save_proposals(self, meeting_id, run_id, proposals: list[dict]) -> list[dict]:
        if not proposals:
            return []
        rows = [
            {
                "run_id": run_id,
                "meeting_id": meeting_id,
                "kind": proposal["kind"],
                "payload": proposal["payload"],
                "status": proposal.get("status", "pending"),
                "issue_id": proposal.get("issue_id"),
                "task_id": proposal.get("task_id"),
            }
            for proposal in proposals
        ]
        return (
            self.db.table("proposals")
            .insert(rows)
            .select(PROPOSAL_COLUMNS)
            .execute()
            .data
        )

    def get_proposals(self, run_id: str | None = None, status: str | None = None) -> list[dict]:
        query = self.db.table("proposals").select(PROPOSAL_COLUMNS)
        if run_id is not None:
            query = query.eq("run_id", run_id)
        if status is not None:
            query = query.eq("status", status)
        return query.order("id").execute().data

    def update_proposal(self, proposal_id: int, fields: dict) -> None:
        updated = (
            self.db.table("proposals")
            .update(fields)
            .eq("id", proposal_id)
            .select("id")
            .execute()
            .data
        )
        if not updated:
            raise KeyError(f"no proposal {proposal_id}")
