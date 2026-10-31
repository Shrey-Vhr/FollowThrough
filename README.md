# FollowThrough

> Wispr Notetaker captures what was said. **FollowThrough makes sure it gets done.**

## The problem
Meetings end with decisions, owners and deadlines that live only in a transcript. Two weeks later nobody remembers
what was decided, a decision quietly contradicts an earlier one, and the same task has been "promised" three times.

## The solution
FollowThrough is an agentic web app on top of **Wispr Flow Notetaker** (the bot-free meeting recorder). It:

- imports transcripts from Wispr (MCP), or by paste / upload;
- extracts decisions, tasks, owners and deadlines, and keeps a **decision ledger** across meetings;
- **detects conflicts** with earlier decisions and flags vague deadlines and unowned tasks;
- tracks **commitments** (a task re-promised across meetings counts its rollovers);
- turns everything into proposed actions (Notion tasks, Slack messages, emails) that wait in a **Review Queue**.
  Nothing leaves FollowThrough until a human approves it;
- **reminds** owners on Slack before a deadline, drafts **weekly digests**, and builds **pre-meeting briefs**.

## How Wispr Flow is used
1. **Notetaker via MCP (input).** The backend connects to Wispr's remote MCP server
   (`https://api.wisprflow.ai/connect/mcp`, OAuth, one-time sign-in) to list meetings and pull full transcripts.
2. **Flow dictation (voice approvals + agenda).** Hold the Flow key and speak into the Review Queue box
   ("approve 1 and 3, give the OTP bug to Pragti due November 10th"); Flow types the command and an LLM parser turns it
   into structured actions with a preview before anything is sent. The same dictation fills the agenda for pre-meeting briefs.

## Architecture
```
Wispr Notetaker --MCP--> FastAPI --LangGraph ingest graph--> Supabase Postgres (+pgvector)
paste / upload ---------^     |      load → extract → resolve dates → embed/save decisions → detect conflicts
                              |      → match open tasks → save tasks → detect gaps → build proposals
                              |      → human_review (interrupt, Postgres checkpointer) → execute
Next.js frontend <--REST + SSE-+      voice-command graph · brief graph · digest graph · APScheduler reminders
                                      executor → Notion (tasks) · Slack (messages, reminders) · Resend (email)
```
- `backend/app/agents/` – LangGraph graphs, store protocol (`STORE_CONTRACT.md`), `runtime.py` (single plug-in point).
- `backend/app/db/` – `SupabaseStore`, repo helpers. `db/schema.sql` – schema + patches.
- `backend/app/api/` – meetings, Wispr, runs (SSE), issues, dev tools. `backend/app/integrations/` – Wispr MCP, Notion, Slack, email, executor.
- `backend/app/scheduler/` – reminder job. `frontend/` – Next.js app (has a mock mode).

## Setup
Backend (Python 3.11+, port **8001**):
```bash
cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
cp .env.example .env            # fill in the values (names listed below)
.venv/Scripts/python -m app.integrations.wispr_login   # one-time Wispr sign-in (tokens -> wispr_tokens.json, git-ignored)
.venv/Scripts/python -m uvicorn app.main:app --port 8001 --loop app.main:selector_loop_factory
```
The `--loop` flag is needed on Windows (psycopg async cannot use the default Proactor loop).
Apply `db/schema.sql` to your Supabase project (and `db/seed_people.sql`).

Frontend:
```bash
cd frontend && npm install
# .env.local: NEXT_PUBLIC_USE_MOCKS=false  NEXT_PUBLIC_API_URL=http://localhost:8001
npm run dev
```

Demo data: `POST /dev/reset-supabase` wipes data (keeps people), imports the 3 seed meetings with their real dates and
processes meetings 1–2 (cached extraction); meeting 3 is left for a live "Run agent".
Checks: `python -m app.db.test_store` (destructive), `python -m app.agents.test_confirm` (needs a server with `USE_REAL_INTEGRATIONS=false`).

## Environment variables (names only)
Backend: `OPENAI_API_KEY`, `LLM_MODEL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`,
`FRONTEND_ORIGIN`, `WISPR_MCP_URL`, `USE_SUPABASE_STORE`, `USE_POSTGRES_CHECKPOINTER`, `USE_REAL_INTEGRATIONS`,
`SCHEDULER_ENABLED`, `NOTION_TOKEN`, `NOTION_TASKS_DATABASE_ID`, `NOTION_TASKS_DATA_SOURCE_ID`, `SLACK_BOT_TOKEN`,
`SLACK_CHANNEL_ID`, `SLACK_USER_ID_SHREY`, `RESEND_API_KEY`, `RESEND_TEST_RECIPIENT`.
Frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_USE_MOCKS`.

## Team
- **Shrey Vohra** – frontend (Next.js), LangGraph agents (ingest, voice parser, brief, digest), store contract, review-queue API, insights API.
- **Pragti Aggarwal** – Supabase project and schema, FastAPI skeleton, transcript parser, paste/upload routes, Wispr MCP client and OAuth, first `SupabaseStore`.
- Integration, live-run plumbing, Notion/Slack/email executor, reminders and end-to-end hardening were completed with Claude Code.
