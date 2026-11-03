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

## Quick look (no keys needed)
The frontend ships with a mock mode that serves realistic demo data, so you can click through every screen without a backend:
```bash
cd frontend
npm install
cp .env.example .env.local      # NEXT_PUBLIC_USE_MOCKS=true by default
npm run dev                     # http://localhost:3000
```

## Full setup
Requirements: **Python 3.11+**, **Node.js 20+**, a **Supabase** project (Postgres + pgvector) and an **OpenAI** API key.
Notion, Slack, Resend and Wispr are optional (see `USE_REAL_INTEGRATIONS` and the Wispr step below).

**1. Database.** In the Supabase SQL editor run `db/schema.sql`, then `db/seed_people.sql`
(edit the names/emails there to match your team).

**2. Backend** (port **8001**):
```bash
cd backend
python -m venv .venv
# Windows:      .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # fill in the values (see below)
python -m app.integrations.wispr_login   # optional, one-time Wispr sign-in (tokens -> wispr_tokens.json, git-ignored)
python -m uvicorn app.main:app --port 8001 --loop app.main:selector_loop_factory
```
The `--loop` flag matters on Windows (psycopg async cannot use the default Proactor loop) and is harmless elsewhere.
Check it is up: `http://localhost:8001/health` and the API docs at `http://localhost:8001/docs`.

**3. Frontend** against the real API:
```bash
cd frontend
npm install
cp .env.example .env.local      # then set NEXT_PUBLIC_USE_MOCKS=false
npm run dev
```

**Demo data:** `POST /dev/reset-supabase` wipes data (keeps people), imports the 3 seed meetings from `seed/` with their
real dates and processes meetings 1–2 (cached extraction); meeting 3 is left for a live "Run agent".
Without Wispr tokens the seed meetings are read from `seed/meeting*.txt`.

**Checks** (from `backend/`, venv active): `python -m app.db.test_store` (**destructive**: wipes the database),
`python -m app.agents.test_confirm` (needs a running server with `USE_REAL_INTEGRATIONS=false`).

> The API has no authentication and includes `/dev/*` endpoints that reset data. Run it locally only; do not expose it publicly.

## Environment variables
Backend (`backend/.env`, template in `backend/.env.example`):

| Variable | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY`, `LLM_MODEL` | yes | LLM for extraction, voice commands, briefs, digests |
| `EMBEDDING_MODEL` | no | defaults to `text-embedding-3-small` (1536 dims) |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | yes | Supabase REST access (server-side secret key) |
| `DATABASE_URL` | yes | Postgres session-pooler URL (checkpointer, demo reset) |
| `FRONTEND_ORIGIN` | no | CORS origin, default `http://localhost:3000` |
| `WISPR_MCP_URL` | no | Wispr MCP endpoint |
| `USE_SUPABASE_STORE`, `USE_POSTGRES_CHECKPOINTER` | yes | keep `true` for the full app |
| `USE_REAL_INTEGRATIONS` | no | `false` (default in the template) = dry run, nothing is sent |
| `SCHEDULER_ENABLED` | no | Slack deadline reminders, every minute |
| `NOTION_TOKEN`, `NOTION_TASKS_DATA_SOURCE_ID` | if real | Notion task creation |
| `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID`, `SLACK_USER_ID_SHREY` | if real | Slack messages and reminders |
| `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TEST_RECIPIENT` | if real | email |

Frontend (`frontend/.env.local`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_USE_MOCKS`, `NEXT_PUBLIC_DEMO_MODE` (shows the "Simulate time" control).

## Team

**Shrey Vohra**
- Product planning: problem framing, feature set and system architecture
- LangGraph agent workflows: extraction, cross-meeting conflict detection, commitment tracking, voice-command parsing, pre-meeting briefs, weekly digests
- Human-in-the-loop approval flow (LangGraph interrupts + Review Queue)
- Wispr Flow Notetaker integration via its MCP server (OAuth, meeting listing, transcript import)
- Notion, Slack and Resend integrations, reminders and scheduler
- Frontend (Next.js), built with Claude Code as an AI coding partner

**Pragti Aggarwal**
- Supabase setup with pgvector for the agent's memory
- FastAPI backend foundation and transcript parsing (paste/upload ingestion)
- Co-designed the agentic workflows and co-recorded the test meetings with Wispr Notetaker
