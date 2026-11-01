create extension if not exists vector;

create table people (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text, slack_user_id text,
  aliases text[] default '{}'
);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  title text, held_at timestamptz not null,
  source text check (source in ('wispr','upload','paste')),
  wispr_meeting_id text unique, wispr_summary text,
  status text default 'imported', created_at timestamptz default now()
);

create table segments (
  id bigserial primary key,
  meeting_id uuid references meetings on delete cascade,
  speaker text, person_id uuid references people,
  ts_seconds int, text text
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings on delete cascade,
  topic text, statement text not null, made_by uuid references people,
  source_quote text, ts_seconds int,
  status text default 'active' check (status in ('active','superseded','disputed')),
  superseded_by uuid references decisions,
  embedding vector(1536)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings on delete cascade,
  title text not null, owner_id uuid references people,
  deadline date, deadline_raw text,
  deadline_confidence text check (deadline_confidence in ('exact','inferred','vague','none')),
  status text default 'open' check (status in ('open','in_progress','blocked','completed')),
  rollover_count int default 0, source_quote text, ts_seconds int,
  notion_page_id text, embedding vector(1536)
);

create table task_updates (
  id bigserial primary key,
  task_id uuid references tasks on delete cascade,
  meeting_id uuid references meetings on delete cascade,
  update_type text check (update_type in ('completed','in_progress','blocked','recommitted')),
  quote text, created_at timestamptz default now()
);

create table issues (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings on delete cascade,
  type text check (type in ('conflict','disagreement','vague_deadline','missing_owner')),
  severity text default 'medium', title text, details jsonb,
  decision_id uuid references decisions, related_decision_id uuid references decisions,
  task_id uuid references tasks,
  status text default 'open' check (status in ('open','resolved','flagged'))
);

create table proposals (
  id serial primary key,
  run_id text, meeting_id uuid references meetings,
  kind text check (kind in ('notion_task','slack_message','email')),
  payload jsonb not null,
  status text default 'pending' check (status in ('pending','approved','rejected','sent','failed')),
  result jsonb, created_at timestamptz default now()
);

create table briefs (
  id uuid primary key default gen_random_uuid(),
  agenda text, meeting_at timestamptz, content jsonb,
  created_at timestamptz default now()
);

create table reminders (
  id bigserial primary key,
  task_id uuid references tasks on delete cascade,
  remind_at timestamptz, sent boolean default false
);

alter table segments
  add column if not exists idx int;

alter table decisions
  add column if not exists made_by_id uuid references people;

alter table issues
  add column if not exists resolved_by_decision_id uuid references decisions,
  add column if not exists created_at timestamptz default now();

alter table proposals
  add column if not exists issue_id uuid references issues,
  add column if not exists task_id uuid references tasks;

create or replace function match_decisions(q vector(1536), k int default 5, exclude_meeting uuid default null)
returns table (id uuid, statement text, topic text, meeting_id uuid, similarity float)
language sql stable as $$
  select id, statement, topic, meeting_id, 1 - (embedding <=> q) as similarity
  from decisions
  where status = 'active' and embedding is not null
    and (exclude_meeting is null or meeting_id <> exclude_meeting)
  order by embedding <=> q limit k;
$$;

create or replace function match_open_tasks(q vector(1536), k int default 5, exclude_meeting uuid default null)
returns table (id uuid, title text, owner_id uuid, deadline date, similarity float)
language sql stable as $$
  select id, title, owner_id, deadline, 1 - (embedding <=> q) as similarity
  from tasks
  where status <> 'completed' and embedding is not null
    and (exclude_meeting is null or meeting_id <> exclude_meeting)
  order by embedding <=> q limit k;
$$;

create or replace function search_decisions(q vector(1536), k int default 5, exclude_meeting uuid default null)
returns table (id uuid, statement text, topic text, meeting_id uuid, similarity float)
language sql stable as $$
  select * from match_decisions(q, k, exclude_meeting);
$$;

create or replace function search_tasks(q vector(1536), k int default 5, exclude_meeting uuid default null)
returns table (id uuid, title text, owner_id uuid, deadline date, similarity float)
language sql stable as $$
  select * from match_open_tasks(q, k, exclude_meeting);
$$;

-- Milestone 2: store needs
alter table briefs add column if not exists headline text, add column if not exists topics jsonb;
alter table proposals alter column meeting_id drop not null;
alter table people add column if not exists email text;
create index if not exists segments_meeting_idx on segments (meeting_id, idx);

-- Security: lock every table behind RLS. The backend uses the secret key / direct Postgres
-- connection (both bypass RLS), so this only blocks the public Data API (publishable/anon key).
alter table people enable row level security;
alter table meetings enable row level security;
alter table segments enable row level security;
alter table decisions enable row level security;
alter table tasks enable row level security;
alter table task_updates enable row level security;
alter table issues enable row level security;
alter table proposals enable row level security;
alter table briefs enable row level security;
alter table reminders enable row level security;
