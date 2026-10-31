import { formatShortDate } from "@/lib/format";
import type { LedgerConflict, LedgerDecision, LedgerLineage, LedgerTopic } from "@/lib/types";

const MONTH = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const VALUE = new RegExp(`₹\s?[\d,]+|(?:${MONTH})[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?`, "gi");
const PROPER = /\b[A-Z][a-zA-Z]{2,}\b/g;
const SKIP = new Set(["The", "Use", "Switch", "From", "Launch", "Launches", "Monthly", "Tiffinly", "Users", "Lunch", "Recruit"]);

function shortenDate(v: string): string {
  const m = new RegExp(`^(${MONTH})[a-z]*\.?\s+(\d{1,2})`, "i").exec(v);
  return m ? `${m[1].charAt(0).toUpperCase()}${m[1].slice(1, 3).toLowerCase()} ${m[2]}` : v.replace(/\s+/g, "");
}

function lastOf(re: RegExp, text: string, filter: (v: string) => boolean = () => true): string | undefined {
  return (text.match(re) ?? []).filter(filter).pop();
}

/** What changed between two statements, e.g. { from: "Nov 15", to: "Nov 30" }; null when nothing readable stands out. */
export function changeBetween(before: string, after: string): { from: string; to: string } | null {
  const a = lastOf(VALUE, before);
  const b = lastOf(VALUE, after);
  if (a && b && a.toLowerCase() !== b.toLowerCase()) return { from: shortenDate(a), to: shortenDate(b) };

  const ok = (v: string) => !SKIP.has(v);
  const x = lastOf(PROPER, before, ok);
  const y = lastOf(PROPER, after, (v) => ok(v) && v !== x);
  return x && y ? { from: x, to: y } : null;
}

export interface ChainLink {
  from: LedgerDecision;
  to: LedgerDecision;
  /** True when this step is a flagged conflict (a rose connector) rather than a plain update. */
  conflict: boolean;
  /** Short value change, e.g. "Nov 15 → Nov 30". */
  label: string;
  explanation?: string;
}

/**
 * Pairs up consecutive decisions. The lineage endpoint says which pairs conflict; without it, a topic
 * the ledger flagged with has_conflict treats every superseded→next step as one.
 */
export function buildLinks(
  history: LedgerDecision[],
  lineage: LedgerLineage | undefined,
  hasConflict: boolean,
): ChainLink[] {
  const conflicts: LedgerConflict[] = lineage?.conflicts ?? [];
  const links: ChainLink[] = [];
  for (let i = 0; i < history.length - 1; i++) {
    const from = history[i];
    const to = history[i + 1];
    const hit = conflicts.find(
      (c) =>
        (String(c.decision_id) === String(to.id) && String(c.related_decision_id) === String(from.id)) ||
        (String(c.decision_id) === String(from.id) && String(c.related_decision_id) === String(to.id)),
    );
    const conflict = lineage ? Boolean(hit) : hasConflict && from.status !== "current";
    const change = hit?.old_value && hit?.new_value ? { from: hit.old_value, to: hit.new_value } : changeBetween(from.statement, to.statement);
    const label = change
      ? `${change.from} → ${change.to}`
      : `${formatShortDate(from.held_at)} → ${formatShortDate(to.held_at)}`;
    links.push({ from, to, conflict, label, explanation: hit?.explanation });
  }
  return links;
}

export const isCurrent = (d: LedgerDecision, topic: LedgerTopic) => String(d.id) === String(topic.current.id);

export function matchTopic(topics: LedgerTopic[], wanted: string | null | undefined): LedgerTopic | undefined {
  if (!wanted) return undefined;
  const w = wanted.trim().toLowerCase();
  return (
    topics.find((t) => t.topic.toLowerCase() === w) ??
    topics.find((t) => t.topic.toLowerCase().includes(w) || w.includes(t.topic.toLowerCase()))
  );
}

/** Does the search box text match the topic name or any statement in it? */
export function topicMatches(t: LedgerTopic, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  return t.topic.toLowerCase().includes(n) || t.history.some((d) => d.statement.toLowerCase().includes(n));
}
