import { MOCK_TODAY } from "@/lib/config";
import { daysUntil } from "@/lib/format";
import type {
  ImportWisprBody,
  ImportWisprResult,
  Issue,
  IssueAction,
  MeetingDetail,
  Task,
} from "@/lib/types";
import { seedMeetings, seedProposals, seedWispr, vendorCallAnalysis, vendorCallSegments } from "./data";

/** In-memory "database". Survives client-side navigation, resets on a full reload. */
const db = {
  meetings: seedMeetings(),
  wispr: seedWispr(),
  proposals: seedProposals(),
  runs: new Map<string, number>(),
  nextMeetingId: 4,
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => structuredClone(v);

class MockHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const meetingById = (id: number): MeetingDetail => {
  const m = db.meetings.find((x) => x.id === id);
  if (!m) throw new MockHttpError("Meeting not found", 404);
  return m;
};

const allIssues = (): Issue[] => db.meetings.flatMap((m) => m.issues);

/** Latest snapshot of each task across meetings, tagged with the meeting that last touched it. */
function currentTasks(): Task[] {
  const latest = new Map<number, Task>();
  for (const m of [...db.meetings].sort((a, b) => a.held_at.localeCompare(b.held_at))) {
    for (const t of m.tasks) latest.set(t.id, { ...t, meeting_id: m.id });
  }
  return [...latest.values()];
}

/** Called by the mock stream just before its last event, mimicking the pipeline saving its results. */
export function finalizeMockRun(runId: string): void {
  const id = db.runs.get(runId);
  const m = id ? db.meetings.find((x) => x.id === id) : undefined;
  if (!m) return;
  if (m.status === "imported") {
    m.decisions = clone(vendorCallAnalysis.decisions);
    m.tasks = clone(vendorCallAnalysis.tasks);
    m.issues = vendorCallAnalysis.issues(m.id, m.title);
    m.wispr_summary = "Sunrise Kitchens chosen as launch partner. Tasting box due Nov 10; contract timing still vague.";
  }
  m.status = "processed";
}

export function meetingIdForRun(runId: string): number | undefined {
  return db.runs.get(runId);
}

function importWispr(body: ImportWisprBody): ImportWisprResult {
  const src = db.wispr.find((w) => w.wispr_meeting_id === body.wispr_meeting_id);
  if (!src) throw new MockHttpError("Wispr meeting not found", 404);
  if (!src.has_transcript) throw new MockHttpError("Transcript is not ready yet", 409);
  if (src.already_imported) throw new MockHttpError("Already imported", 409);
  const id = db.nextMeetingId++;
  const date = body.held_at ?? src.start;
  db.meetings.unshift({
    id,
    title: body.title ?? src.title,
    held_at: date.length === 10 ? `${date}T${src.start.slice(11)}` : date,
    source: "wispr",
    status: "imported",
    wispr_summary: src.summary_excerpt,
    segments: clone(vendorCallSegments),
    decisions: [],
    tasks: [],
    issues: [],
  });
  src.already_imported = true;
  return { meeting_id: id, segments: vendorCallSegments.length };
}

function patchIssue(id: number, action: IssueAction): Issue {
  const issue = allIssues().find((i) => i.id === id);
  if (!issue) throw new MockHttpError("Issue not found", 404);
  if (action === "flag") {
    issue.resolution = "flag";
  } else {
    issue.status = "resolved";
    issue.resolution = action;
  }
  return clone(issue);
}

type Init = { method?: string; json?: unknown };

/** Same paths, methods and shapes as the real API. */
export async function mockApi<T>(path: string, init: Init = {}): Promise<T> {
  await wait(250 + Math.random() * 250);
  const method = (init.method ?? "GET").toUpperCase();
  const url = new URL(path, "http://mock.local");
  const p = url.pathname;
  const q = url.searchParams;

  if (method === "GET" && p === "/health") return { status: "ok" } as T;

  if (method === "GET" && p === "/meetings") {
    const rows = [...db.meetings]
      .sort((a, b) => b.held_at.localeCompare(a.held_at))
      .map(({ id, title, held_at, source, status }) => ({ id, title, held_at, source, status }));
    return rows as T;
  }

  if (method === "POST" && p === "/meetings/import/wispr") {
    await wait(500);
    return importWispr(init.json as ImportWisprBody) as T;
  }

  let m = /^\/meetings\/(\d+)$/.exec(p);
  if (method === "GET" && m) return clone(meetingById(Number(m[1]))) as T;

  m = /^\/meetings\/(\d+)\/process$/.exec(p);
  if (method === "POST" && m) {
    meetingById(Number(m[1]));
    const runId = `run_${Math.random().toString(36).slice(2, 10)}`;
    db.runs.set(runId, Number(m[1]));
    return { run_id: runId } as T;
  }

  if (method === "GET" && p === "/issues") {
    const status = q.get("status");
    const type = q.get("type");
    return clone(
      allIssues().filter((i) => (!status || i.status === status) && (!type || i.type === type)),
    ) as T;
  }

  m = /^\/issues\/(\d+)$/.exec(p);
  if (method === "PATCH" && m) {
    return patchIssue(Number(m[1]), (init.json as { action: IssueAction }).action) as T;
  }

  if (method === "GET" && p === "/tasks") {
    const days = Number(q.get("due_within_days") ?? NaN);
    const tasks = currentTasks().filter((t) => {
      if (t.status === "completed") return false;
      if (Number.isNaN(days)) return true;
      return t.deadline !== null && daysUntil(t.deadline, MOCK_TODAY) <= days;
    });
    return tasks.sort((a, b) => (a.deadline ?? "9").localeCompare(b.deadline ?? "9")) as T;
  }

  if (method === "GET" && p === "/proposals") {
    const status = q.get("status");
    return clone(db.proposals.filter((x) => !status || x.status === status)) as T;
  }

  if (method === "GET" && p === "/wispr/meetings") return clone(db.wispr) as T;

  throw new MockHttpError(`No mock for ${method} ${p}`, 404);
}

export { MockHttpError };
