import type { RunEvent } from "@/lib/types";
import { finalizeMockRun } from "./handlers";

const done = (node: string, message: string, data: Record<string, unknown> = {}): RunEvent => ({
  node,
  status: "done",
  message,
  data,
});

/** The scripted pipeline for the seeded "Launch Review" meeting. */
const LAUNCH_REVIEW: RunEvent[] = [
  done("load_transcript", "Loaded 'Tiffinly Launch Review', 23 lines", { lines: 23 }),
  done("extract", "Found 3 decisions, 5 action items", { decisions: 3, action_items: 5 }),
  done("resolve_dates", "Resolved 3 of 5 deadlines to calendar dates"),
  done("embed_and_save_decisions", "Saved 3 decisions to memory", { count: 3 }),
  done("detect_conflicts", "Checked 6 past decisions → 3 conflicts", { checked: 6, conflicts: 3 }),
  done("match_open_tasks", "API spec pushed back again (2nd time)", { task: "Write the API spec", rollover_count: 2 }),
  done("save_new_tasks", "Saved 4 new tasks", { count: 4 }),
  done("detect_gaps", "2 vague deadlines, 1 task without an owner", { vague_deadline: 2, missing_owner: 1 }),
  done("build_proposals", "Drafted 6 proposals", { count: 6 }),
  done("human_review", "Waiting for your approval (6 proposals)", { count: 6, waiting: true }),
];

/** A generic script for any other meeting (e.g. a freshly imported one). */
const GENERIC: RunEvent[] = [
  done("load_transcript", "Loaded transcript, 9 lines", { lines: 9 }),
  done("extract", "Found 1 decision, 2 action items", { decisions: 1, action_items: 2 }),
  done("resolve_dates", "Resolved 1 of 2 deadlines to calendar dates"),
  done("embed_and_save_decisions", "Saved 1 decision to memory", { count: 1 }),
  done("detect_conflicts", "Checked 9 past decisions → 0 conflicts", { checked: 9, conflicts: 0 }),
  done("match_open_tasks", "No open tasks were mentioned", {}),
  done("save_new_tasks", "Saved 2 new tasks", { count: 2 }),
  done("detect_gaps", "1 vague deadline, 0 tasks without an owner", { vague_deadline: 1, missing_owner: 0 }),
  done("build_proposals", "Drafted 3 proposals", { count: 3 }),
  done("human_review", "Waiting for your approval (3 proposals)", { count: 3, waiting: true }),
];

export interface StreamHandlers {
  onEvent: (event: RunEvent) => void;
  onError?: (error: Error) => void;
}

/** Replays the scripted events with 500–900ms between them. Returns an unsubscribe function. */
export function mockRunStream(runId: string, meetingId: number | undefined, h: StreamHandlers): () => void {
  const script = meetingId === 3 ? LAUNCH_REVIEW : GENERIC;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;

  const step = (i: number) => {
    timer = setTimeout(() => {
      if (cancelled) return;
      if (i === script.length - 1) finalizeMockRun(runId);
      h.onEvent(script[i]);
      if (i < script.length - 1) step(i + 1);
    }, 500 + Math.random() * 400);
  };
  step(0);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
