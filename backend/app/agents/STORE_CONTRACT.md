# Store contract (Supabase implementation spec)

The agent graphs only talk to the `Store` protocol in `store.py`. `InMemoryStore` is the reference
implementation; the Supabase store must match these signatures and return shapes exactly.

Notes
- `db/schema.sql` was empty when this was written, so the columns below are what the graphs read
  and write. Align the real schema with them (or tell the agents owner what differs).
- IDs (`*_id`, `id`) are opaque to the graphs: ints in memory, uuids in Supabase are both fine,
  **except `proposals.id`, which must be a small integer** (the voice command refers to "proposal 3").
- Returned rows are plain dicts. Extra keys in input dicts that have no column (e.g. `owner`, a name
  alongside `owner_id`) must be ignored on insert.
- Dates: `meetings.held_at` is an ISO string (`"2026-10-24"` or a full timestamp); `tasks.deadline`
  is `"yyyy-mm-dd"` or null.
- `embedding` is `list[float]` of length `EMBEDDING_DIM` (pgvector `vector(1536)`).

## Reads

### `get_meeting(meeting_id) -> dict`
Returns `{id, title, held_at}`. Table `meetings(id, title, held_at)`.

### `get_segments(meeting_id) -> list[dict]`
Transcript lines in order, each `{speaker, person_id, text}`. `speaker` is the raw label from the
transcript (e.g. `"Shrey Vohra (You)"`); `person_id` is null if the speaker couldn't be mapped.
Table `segments(id, meeting_id, idx, speaker, person_id, text)`; order by `idx`.

### `list_people() -> list[dict]`
`[{id, name, aliases: list[str]}]`. Table `people(id, name, aliases text[])`.

### `get_open_tasks(exclude_meeting_id) -> list[dict]`
Tasks from other meetings whose `status != 'completed'`. Each row has all task columns **except
`embedding`**, plus joined fields: `owner` (people.name or null), `meeting_title`, `meeting_date`
(`meetings.held_at` as `yyyy-mm-dd`). Table `tasks` join `people` join `meetings`.

### `match_decisions(embedding, k, exclude_meeting_id) -> list[dict]`
Vector search over past decisions (`meeting_id != exclude_meeting_id`), top `k`, best first.
Each row: `{id, meeting_id, topic, statement, made_by, source_quote, similarity, meeting_title,
meeting_date}` where `similarity` is cosine similarity (1 - cosine distance, higher = closer).
No `embedding` in the result. Table `decisions` join `meetings`; suggest an RPC using `<=>`.

### `get_open_issues(issue_type: str | None = None) -> list[dict]`
Issues with `status = 'open'`, optionally filtered by `type`. Full issue rows (see `save_issue`).

## Writes

### `save_decisions(meeting_id, decisions: list[dict]) -> list[dict]`
Input keys: `topic, statement, made_by, made_by_id, source_quote, ts_seconds, embedding`.
Returns the inserted rows (all input keys plus `id`, `meeting_id`) **including `embedding`** — the
graph reuses it for conflict matching. Table `decisions(id, meeting_id, topic, statement, made_by,
made_by_id, source_quote, ts_seconds, embedding)`.

### `save_tasks(meeting_id, tasks: list[dict]) -> list[dict]`
Input keys: `title, owner (name, ignore), owner_id, deadline_raw, deadline, deadline_confidence,
source_quote, embedding`. Defaults applied by the store: `status='open'`, `rollover_count=0`.
Returns inserted rows with `id` and `meeting_id`. `owner` (the name) must be included in the
returned row (join it back from `people`) — the graph reads `task["owner"]`.
Table `tasks(id, meeting_id, title, owner_id, deadline_raw, deadline date, deadline_confidence,
status, rollover_count, source_quote, embedding)`.
- `deadline_confidence`: `exact | inferred | vague | none`
- `status`: `open | in_progress | blocked | completed`

### `update_task(task_id, fields: dict) -> None`
Partial update of `tasks`. Keys the graph sends: `status, rollover_count, deadline_raw, deadline,
deadline_confidence`.

### `save_task_update(task_id, meeting_id, update_type, quote) -> None`
Insert into `task_updates(id, task_id, meeting_id, update_type, quote, created_at)`.
`update_type`: `completed | in_progress | blocked | recommitted`. `quote` may be null.

### `save_issue(issue: dict) -> dict`
Input keys (all optional except `type`, `title`, `details`, `meeting_id`): `type, title, details,
meeting_id, decision_id, related_decision_id, task_id`. Store defaults `status='open'`.
Returns the inserted row including `id`. Table `issues(id, type, title, details jsonb, status,
meeting_id, decision_id, related_decision_id, task_id, resolved_by_decision_id, created_at)`.
- `type`: `conflict | vague_deadline | missing_owner | disagreement`
- `status`: `open | resolved`
- `details` shapes:
  - conflict: `{new, past, relation, explanation, confidence}` (`new`/`past` are decision views with
    `meeting_title, meeting_date, topic, statement, made_by, source_quote`)
  - vague_deadline: `{task_title, owner, deadline_raw}`
  - missing_owner: `{task_title, deadline_raw}`
  - disagreement: `{topic, positions: [{person, view}], source_quote}`

### `update_issue(issue_id, fields: dict) -> None`
Partial update of `issues`. Keys sent: `status`, `resolved_by_decision_id`.

### `save_proposals(meeting_id, run_id, proposals: list[dict]) -> list[dict]`
Input keys: `kind, payload, issue_id (optional), task_id (optional)`. Store defaults
`status='pending'`. Returns inserted rows with an **integer `id`**, `meeting_id`, `run_id`.
Table `proposals(id serial, run_id, meeting_id, kind, payload jsonb, status, issue_id, task_id)`.
- `kind`: `notion_task | slack_message | email`
- `status`: `pending | approved | rejected | sent | failed | superseded` (`executed` is replaced by
  `sent`/`failed`; `superseded` = a later meeting recommitted/completed the task, so this pending
  proposal is stale. **Add `'superseded'` to the `proposals.status` check constraint in `db/schema.sql`.**)
- payloads: notion_task `{title, owner, owner_id, deadline, deadline_raw, source_quote}`;
  slack_message `{channel, text}`. Review edits may add/overwrite payload keys `owner, owner_id,
  due_date (yyyy-mm-dd; notion_task also gets `deadline`), text (notion_task also gets `title`)`.
- Add column `result jsonb` (executor outcome `{ok, external_id, error}`, null until executed).

### `get_proposals(run_id: str | None = None, status: str | None = None) -> list[dict]`
Full proposal rows (see `save_proposals`), filtered by `run_id` and/or `status` when given, ordered
by `id`. Both `None` returns every proposal. Rows include `result` once executed.

### `update_proposal(proposal_id: int, fields: dict) -> None`
Partial update of `proposals`. Keys sent: `status`, `payload` (the whole merged jsonb), `result`.
Unknown id → raise (the in-memory store raises `KeyError`).

## Insights reads (briefs, digest, ledger, commitments)

None of these return `embedding`. `people` rows may now carry an optional `email` (add `email text`
to `people`); the weekly digest skips people without one.

### `list_decisions(topic: str | None = None) -> list[dict]`
All decisions (optionally `topic ilike %topic%`), ordered by `held_at`, then `id`. Row: `{id,
meeting_id, topic, statement, made_by, source_quote, meeting_title, held_at, status, superseded_by}`.
`status` is derived, not stored: `"superseded"` if some `conflict` issue with `details.relation in
(contradicts, supersedes)` has `related_decision_id = this id` (then `superseded_by` = that issue's
`decision_id`, the newest one if several), else `"current"` with `superseded_by = null`.

### `list_tasks(owner_id=None, status: str | None = None) -> list[dict]`
All tasks, filtered when given, ordered by `id`. Row: all task columns (`id, meeting_id, title,
owner_id, deadline_raw, deadline, deadline_confidence, status, rollover_count, source_quote`) plus
`owner_name` (people.name or null), `meeting_title`, `meeting_date` (`yyyy-mm-dd`).

### `list_task_updates(task_id=None) -> list[dict]`
`task_updates` rows for the task (every task when `task_id` is None), oldest first: `{id, task_id, meeting_id, update_type, quote,
meeting_title, meeting_date}`.

### `list_issues(status: str | None = None, issue_type: str | None = None) -> list[dict]`
Full issue rows (see `save_issue`), any status unless filtered, ordered by `id`.

### `search_decisions(embedding, k) -> list[dict]` / `search_tasks(embedding, k) -> list[dict]`
Vector search over **all** meetings (unlike `match_decisions`), top `k`, best first. Rows are the
`list_decisions` / `list_tasks` rows plus `similarity` (cosine, higher = closer).

### `list_briefs() -> list[dict]`
All briefs, newest first (`id` descending).

## Insights writes

### `save_brief(brief: dict) -> dict`
Input: `{agenda, meeting_at (nullable), headline, topics: [...]}` (see `BriefOut` in `schemas.py`).
Returns the row with `id` and `created_at`. Table `briefs(id serial, agenda text, meeting_at
timestamptz, headline text, topics jsonb, created_at)`. `get_brief(brief_id) -> dict` returns the
same row (raise if unknown; the in-memory store raises `KeyError`).

### Email proposals (weekly digest)
`save_proposals` is also called with `meeting_id = None` and `kind = "email"`: make
`proposals.meeting_id` nullable and add `'email'` to the `kind` check. Payload `{to, to_name,
subject, body}`; review edits may overwrite `body` via `edit_text`. The `run_id` is
`"digest-<uuid>"`; these runs have no ingest-graph checkpoint, so `/proposals/confirm` applies the
review and executes them directly (see `api_proposals.py`).

## For Pragti

Everything the agents need is wired in `app/agents/runtime.py`; routes never build their own graph.

- **Store:** implement `SupabaseStore` in `app/db/store.py` (this contract) and set
  `USE_SUPABASE_STORE=true`. `runtime.get_store()` imports and returns it.
- **Checkpointer:** replace the `InMemorySaver` in `runtime.get_checkpointer()` with the Postgres
  checkpointer (see the TODO there), so paused runs survive restarts.
- **Executor:** return your Notion/Slack/email executor from `runtime.get_executor()` (TODO there).
  Signature: `executor(proposal) -> {"ok": bool, "external_id": str | None, "error": str | None}`.
- **`/meetings/{id}/process`:** use `runtime.get_ingest_graph()` and `start_run()` /
  `start_run_stream()` from `app.agents.graphs.ingest`. Do not call `build_ingest_graph` yourself,
  otherwise the run is checkpointed somewhere `/proposals/confirm` can't resume it from.
- **`/runs/{id}/stream`:** forward the items from `start_run_stream` / `resume_run_stream` over SSE.
- `/dev/seed-demo` only works in in-memory mode (it returns 400 when `USE_SUPABASE_STORE=true`).
