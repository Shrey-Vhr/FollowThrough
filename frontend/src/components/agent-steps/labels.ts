import type { RunEvent } from "@/lib/types";

/** Pipeline order, used to guess which step is in flight while waiting for the next event. */
export const NODE_ORDER = [
  "load_transcript",
  "extract",
  "resolve_dates",
  "embed_and_save_decisions",
  "detect_conflicts",
  "match_open_tasks",
  "save_new_tasks",
  "detect_gaps",
  "build_proposals",
  "human_review",
] as const;

/** Shown (with a spinner) while a step is running. */
export const RUNNING_LABEL: Record<string, string> = {
  load_transcript: "Reading the transcript…",
  extract: "Extracting decisions and action items…",
  resolve_dates: "Turning spoken deadlines into dates…",
  embed_and_save_decisions: "Saving decisions to memory…",
  detect_conflicts: "Comparing against past decisions…",
  match_open_tasks: "Checking open tasks from earlier meetings…",
  save_new_tasks: "Saving new tasks…",
  detect_gaps: "Looking for gaps…",
  build_proposals: "Drafting proposals…",
  human_review: "Preparing your review…",
};

export function nextNode(events: RunEvent[]): string | null {
  const last = events[events.length - 1]?.node;
  if (!last) return NODE_ORDER[0];
  const i = NODE_ORDER.indexOf(last as (typeof NODE_ORDER)[number]);
  return i >= 0 && i < NODE_ORDER.length - 1 ? NODE_ORDER[i + 1] : null;
}

export function proposalCount(event: RunEvent): number | null {
  const fromData = event.data?.count;
  if (typeof fromData === "number") return fromData;
  const m = /\((\d+)\s+proposals?\)/.exec(event.message);
  return m ? Number(m[1]) : null;
}
