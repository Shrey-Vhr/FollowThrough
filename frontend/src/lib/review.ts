import { formatShortDate } from "./format";
import { resolvePerson } from "./people";
import type { Proposal, ProposalKind, ReviewAction } from "./types";

/** People a task can be assigned to (matches the backend's people table). */
export const PEOPLE = ["Shrey Vohra", "Pragti", "Rahul"] as const;

export const KIND_LABEL: Record<ProposalKind, string> = {
  notion_task: "Notion task",
  slack_message: "Slack message",
  email: "Email",
};

// ---- payload accessors ----------------------------------------------------

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

export const payloadOwner = (p: Proposal) => str(p.payload.owner);
export const payloadDue = (p: Proposal) => str(p.payload.due_date) ?? str(p.payload.deadline);
export const payloadTitle = (p: Proposal) => str(p.payload.title);
/** The editable body: Slack text, email body, or a task's title. */
export const payloadText = (p: Proposal) =>
  str(p.payload.text) ?? str(p.payload.body) ?? str(p.payload.title) ?? "";
export const payloadTarget = (p: Proposal) =>
  str(p.payload.channel) ?? str(p.payload.user) ?? str(p.payload.to);

/** Short name for lists: the task title, the email subject, or the start of the message. */
export function proposalHeadline(p: Proposal): string {
  const title = payloadTitle(p) ?? str(p.payload.subject);
  if (title) return title;
  const text = payloadText(p);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** The number shown to the user: display_no from the API, falling back to the id. */
export const numberOf = (p: Proposal) => p.display_no ?? p.id;

// ---- staged actions ---------------------------------------------------------

export type Decision = "approve" | "reject";

export function decisionOf(actions: ReviewAction[], id: number): Decision | null {
  let found: Decision | null = null;
  for (const a of actions) {
    if ((a.action === "approve" || a.action === "reject") && a.proposal_ids.includes(id)) found = a.action;
  }
  return found;
}

/** Toggle a manual approve/reject for one proposal: pressing the active one clears it. */
export function toggleDecision(actions: ReviewAction[], id: number, kind: Decision): ReviewAction[] {
  const wasSame = decisionOf(actions, id) === kind;
  const rest = actions
    .map((a) =>
      a.action === "approve" || a.action === "reject"
        ? { ...a, proposal_ids: a.proposal_ids.filter((x) => x !== id) }
        : a,
    )
    .filter((a) => a.proposal_ids.length > 0);
  if (wasSame) return rest;
  const idx = rest.findIndex((a) => a.action === kind);
  if (idx >= 0) return rest.map((a, i) => (i === idx ? { ...a, proposal_ids: [...a.proposal_ids, id] } : a));
  return [...rest, { action: kind, proposal_ids: [id], to: null, date: null, text: null }];
}

export interface Effects {
  decision: Decision | null;
  owner: string | null;
  due: string | null;
  text: string | null;
}

export function effectsOf(actions: ReviewAction[], id: number): Effects {
  const fx: Effects = { decision: decisionOf(actions, id), owner: null, due: null, text: null };
  for (const a of actions) {
    if (!a.proposal_ids.includes(id)) continue;
    if (a.action === "reassign" && a.to) fx.owner = a.to;
    else if (a.action === "set_deadline" && a.date) fx.due = a.date;
    else if (a.action === "edit_text" && a.text != null) fx.text = a.text;
  }
  return fx;
}

export const hasEffects = (fx: Effects) => Boolean(fx.decision || fx.owner || fx.due || fx.text !== null);

export function affectedIds(actions: ReviewAction[]): number[] {
  return [...new Set(actions.flatMap((a) => a.proposal_ids))].sort((a, b) => a - b);
}

// ---- preview sentence (same wording as the backend's preview_actions) ----------

const join = (items: string[]) =>
  items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

export function describePreview(pending: Proposal[], actions: ReviewAction[]): string {
  const known = new Set(pending.map((p) => p.id));
  const sentences: string[] = [];
  const label = (p: Proposal) => {
    const fx = effectsOf(actions, p.id);
    const parts = [
      ...(fx.owner ? [`reassigned to ${fx.owner}`] : []),
      ...(fx.due ? [`due ${formatShortDate(fx.due)}`] : []),
      ...(fx.text !== null ? ["text edited"] : []),
    ];
    return parts.length ? `#${numberOf(p)} (${parts.join(", ")})` : `#${numberOf(p)}`;
  };
  const ordered = [...pending].sort((a, b) => a.id - b.id);
  for (const [verb, kind] of [["Approve", "approve"], ["Reject", "reject"]] as const) {
    const items = ordered.filter((p) => known.has(p.id) && decisionOf(actions, p.id) === kind);
    if (items.length) sentences.push(`${verb} ${join(items.map(label))}.`);
  }
  const waiting = ordered.filter((p) => !decisionOf(actions, p.id) && affectedIds(actions).includes(p.id));
  if (waiting.length) {
    sentences.push(`${join(waiting.map(label))} ${waiting.length === 1 ? "stays" : "stay"} pending.`);
  }
  return sentences.join(" ") || "No changes.";
}

// ---- before → after rows for the preview dialog ------------------------------

export interface ChangeRow {
  proposal: Proposal;
  changes: { label: string; before: string | null; after: string }[];
  decision: Decision | null;
}

export function changeRows(pending: Proposal[], actions: ReviewAction[]): ChangeRow[] {
  const ids = new Set(affectedIds(actions));
  return pending
    .filter((p) => ids.has(p.id))
    .sort((a, b) => a.id - b.id)
    .map((proposal) => {
      const fx = effectsOf(actions, proposal.id);
      const changes: ChangeRow["changes"] = [];
      if (fx.owner) {
        const before = payloadOwner(proposal);
        changes.push({
          label: "Owner",
          before: before ? resolvePerson(before).name : null,
          after: resolvePerson(fx.owner).name,
        });
      }
      if (fx.due) {
        const before = payloadDue(proposal);
        changes.push({ label: "Due", before: before ? formatShortDate(before) : null, after: formatShortDate(fx.due) });
      }
      if (fx.text !== null) changes.push({ label: "Text", before: null, after: fx.text });
      return { proposal, changes, decision: fx.decision };
    });
}
