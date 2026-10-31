"""Notion: create a task page in the tasks database."""
import os

from notion_client import Client


def _client() -> Client:
    return Client(auth=os.environ["NOTION_TOKEN"])


def create_task(title: str, owner: str | None = None, due_date: str | None = None,
                source_meeting: str | None = None) -> dict:
    """Returns {"id", "url"} of the new page. Property names match the FollowThrough tasks database."""
    props: dict = {
        "Name": {"title": [{"text": {"content": title[:2000]}}]},
        "Status": {"select": {"name": "To do"}},
    }
    if owner:
        props["Owner"] = {"rich_text": [{"text": {"content": owner}}]}
    if due_date:
        props["Due"] = {"date": {"start": due_date[:10]}}
    if source_meeting:
        props["Meeting"] = {"rich_text": [{"text": {"content": source_meeting}}]}
    page = _client().pages.create(
        parent={"type": "data_source_id", "data_source_id": os.environ["NOTION_TASKS_DATA_SOURCE_ID"]},
        properties=props,
    )
    return {"id": page["id"], "url": page["url"]}
