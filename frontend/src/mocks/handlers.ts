import { MOCK_TODAY } from "@/lib/config";
import { daysUntil } from "@/lib/format";
import type {
  ImportWisprBody,
  ImportWisprResult,
  Issue,
  IssueAction,
  MeetingDetail,
  Proposal,
  ReviewAction,
  Task,
} from "@/lib/types";
import { parseVoiceCommand } from "./voice";
import { describePreview } from "@/lib/review";
import { buildMockBrief, mockCommitments, mockDigestProposals, mockLedger, mockLineage, seedBriefs } from "./story";
import { seedMeetings, seedProposals, seedWispr, vendorCallAnalysis, vendorCallSegments } from "./data";

/** In-memory "database". Survives client-side navigation, resets on a full reload. */
const db = {
  meetings: seedMeetings(),
  wispr: seedWispr(),
  proposals: seedProposals(),
  runs: new Map<string, number>(),
  briefs: seedBriefs(),
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

const SEND_LINKS: Record<Proposal["kind"], (p: Proposal) => string> = {
  notion_task: (p) => `https://www.notion.so/tiffinly/${p.id}-${String(p.payload.title ?? "task").toLowerCase().replace(/\W+/g, "-")}`,
  slack_message: (p) => `https://tiffinly.slack.com/archives/C0TIFFIN/p17300000${String(p.id).padStart(2, "0")}`,
  email: (p) => `https://mail.google.com/mail/u/0/#sent/${p.id}`,
};

/** Pending proposals in id order, each with the number the user sees (like the real API). */
function proposalsWithNumbers(): Proposal[] {
  const pending = db.proposals.filter((p) => p.status === "pending").sort((a, b) => a.id - b.id);
  const numbers = new Map(pending.map((p, i) => [p.id, i + 1]));
  return db.proposals.map((p) => ({ ...p, display_no: numbers.get(p.id) ?? null }));
}

function findProposal(id: number): Proposal {
  const p = db.proposals.find((x) => x.id === id);
  if (!p) throw new MockHttpError(`No proposal ${id}.`, 404);
  return p;
}

function patchProposal(id: number, body: { payload?: Record<string, unknown>; status?: "pending" | "rejected" }) {
  const p = findProposal(id);
  if (p.status !== "pending" && p.status !== "rejected") {
    throw new MockHttpError(`Proposal ${id} is already ${p.status} and can't be edited.`, 409);
  }
  if (body.payload) {
    p.payload = { ...p.payload, ...body.payload };
    if (p.kind === "notion_task" && "due_date" in body.payload) p.payload.deadline = body.payload.due_date;
  }
  if (body.status) p.status = body.status;
  p.summary = summarize(p);
  return proposalsWithNumbers().find((x) => x.id === id)!;
}

function summarize(p: Proposal): string {
  const pl = p.payload as Record<string, string | null>;
  if (p.kind === "notion_task") return `Create task: ${pl.title} → ${pl.owner ?? "no owner"}, due ${pl.due_date ?? "no date"}`;
  if (p.kind === "email") return `Email to ${pl.to}: ${pl.subject}`;
  return `Slack to ${pl.channel ?? pl.user}: ${(pl.text ?? "").slice(0, 70)}`;
}

function applyAction(p: Proposal, a: ReviewAction) {
  if (a.action === "approve") p.status = "approved";
  else if (a.action === "reject") p.status = "rejected";
  else if (a.action === "reassign" && a.to) p.payload = { ...p.payload, owner: a.to };
  else if (a.action === "set_deadline" && a.date) p.payload = { ...p.payload, due_date: a.date, deadline: a.date };
  else if (a.action === "edit_text" && a.text != null) {
    p.payload = { ...p.payload, text: a.text, ...(p.kind === "notion_task" ? { title: a.text } : {}) };
  }
  p.summary = summarize(p);
}

async function confirmProposals(actions: ReviewAction[]) {
  if (!actions.length) throw new MockHttpError("No actions to confirm.", 400);
  const ids = [...new Set(actions.flatMap((a) => a.proposal_ids))].sort((a, b) => a - b);
  ids.forEach(findProposal);
  // Only pending proposals can still change, which makes confirming twice harmless.
  const before = proposalsWithNumbers();
  const pending = before.filter((p) => ids.includes(p.id) && p.status === "pending");
  const preview = describePreview(pending, actions);
  for (const a of actions) {
    for (const id of a.proposal_ids) {
      const p = db.proposals.find((x) => x.id === id);
      if (p && p.status === "pending") applyAction(p, a);
    }
  }
  await wait(1200); // the "executor" talking to Notion / Slack
  for (const id of ids) {
    const p = db.proposals.find((x) => x.id === id)!;
    if (p.status === "approved") {
      p.status = "sent";
      p.result = { ok: true, external_id: `mock-${p.id}`, url: SEND_LINKS[p.kind](p), error: null };
    }
  }
  const updated = proposalsWithNumbers().filter((p) => pending.some((x) => x.id === p.id));
  return { proposals: clone(updated), preview };
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
    return clone(proposalsWithNumbers().filter((x) => !status || x.status === status)) as T;
  }

  m = /^\/proposals\/(\d+)$/.exec(p);
  if (method === "PATCH" && m) {
    return clone(patchProposal(Number(m[1]), init.json as Parameters<typeof patchProposal>[1])) as T;
  }

  if (method === "POST" && p === "/proposals/voice-command") {
    const text = String((init.json as { text?: string })?.text ?? "").trim();
    const pending = proposalsWithNumbers().filter((x) => x.status === "pending");
    if (!text) throw new MockHttpError("Say or type a command first.", 400);
    if (!pending.length) throw new MockHttpError("There are no pending proposals to act on.", 400);
    await wait(400);
    return parseVoiceCommand(text, pending) as T;
  }

  if (method === "POST" && p === "/proposals/confirm") {
    return (await confirmProposals((init.json as { actions: ReviewAction[] }).actions ?? [])) as T;
  }

  if (method === "GET" && p === "/wispr/meetings") return clone(db.wispr) as T;

  if (method === "POST" && p === "/briefs") {
    const body = init.json as { agenda?: string; meeting_at?: string };
    if (!body?.agenda?.trim()) throw new MockHttpError("The agenda is empty.", 422);
    await wait(3200); // splitting, searching, writing
    const brief = buildMockBrief(body.agenda.trim(), Math.max(0, ...db.briefs.map((b) => Number(b.id))) + 1, body.meeting_at);
    db.briefs.unshift(brief);
    return clone(brief) as T;
  }

  if (method === "GET" && p === "/briefs") {
    return clone([...db.briefs].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))) as T;
  }

  m = /^\/briefs\/(\w+)$/.exec(p);
  if (method === "GET" && m) {
    const brief = db.briefs.find((b) => String(b.id) === m![1]);
    if (!brief) throw new MockHttpError(`No brief ${m[1]}.`, 404);
    return clone(brief) as T;
  }

  if (method === "POST" && p === "/digests/run") {
    await wait(900);
    // Re-running replaces the previous unsent digest drafts rather than stacking duplicates.
    db.proposals = db.proposals.filter((x) => !(x.payload.digest && x.status === "pending"));
    let next = Math.max(0, ...db.proposals.map((x) => x.id)) + 1;
    const created = mockDigestProposals().map((x) => ({ ...x, id: next++ }));
    db.proposals.push(...created);
    return { proposals_created: created.length, proposal_ids: created.map((x) => x.id) } as T;
  }

  if (method === "GET" && p === "/commitments") return mockCommitments() as T;

  if (method === "GET" && p === "/ledger/decisions") {
    const topic = q.get("topic")?.toLowerCase();
    return mockLedger().filter((t) => !topic || t.topic.toLowerCase().includes(topic)) as T;
  }

  m = /^\/ledger\/lineage\/(\w+)$/.exec(p);
  if (method === "GET" && m) {
    const lineage = mockLineage(m[1]);
    if (!lineage) throw new MockHttpError(`No decision ${m[1]}.`, 404);
    return lineage as T;
  }

  throw new MockHttpError(`No mock for ${method} ${p}`, 404);
}

export { MockHttpError };
