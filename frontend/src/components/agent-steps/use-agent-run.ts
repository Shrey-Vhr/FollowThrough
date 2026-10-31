"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { toast } from "sonner";
import { followthrough as ft } from "@/lib/api";
import { subscribeToRun } from "@/lib/run-stream";
import type { RunEvent } from "@/lib/types";

export type RunPhase = "idle" | "starting" | "streaming" | "review" | "error";

export interface RunState {
  phase: RunPhase;
  runId: string | null;
  events: RunEvent[];
  error: string | null;
}

type Action =
  | { type: "start" }
  | { type: "started"; runId: string }
  | { type: "event"; event: RunEvent }
  | { type: "error"; message: string };

const initial: RunState = { phase: "idle", runId: null, events: [], error: null };

function reducer(state: RunState, a: Action): RunState {
  switch (a.type) {
    case "start":
      return { phase: "starting", runId: null, events: [], error: null };
    case "started":
      return { ...state, phase: "streaming", runId: a.runId };
    case "event":
      return {
        ...state,
        events: [...state.events, a.event],
        phase: a.event.node === "human_review" ? "review" : a.event.status === "error" ? "error" : "streaming",
        error: a.event.status === "error" ? a.event.message : state.error,
      };
    case "error":
      return { ...state, phase: "error", error: a.message };
  }
}

/** Starts an agent run for a meeting and tracks its streamed events. */
export function useAgentRun(meetingId: number) {
  const qc = useQueryClient();
  const [state, dispatch] = useReducer(reducer, initial);
  const unsubscribe = useRef<() => void>(() => {});
  useEffect(() => () => unsubscribe.current(), []);

  const refetchEverything = useCallback(() => {
    for (const key of [["meeting", meetingId], ["meetings"], ["issues"], ["tasks"], ["proposals"]]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  }, [qc, meetingId]);

  const start = useCallback(async () => {
    unsubscribe.current();
    dispatch({ type: "start" });
    try {
      const { run_id } = await ft.process(meetingId);
      dispatch({ type: "started", runId: run_id });
      unsubscribe.current = subscribeToRun(run_id, meetingId, {
        onEvent: (event) => {
          dispatch({ type: "event", event });
          // Analysis results are saved by the time the run reaches human review.
          if (event.node === "human_review") refetchEverything();
        },
        onError: (e) => {
          dispatch({ type: "error", message: e.message });
          toast.error("Agent run interrupted", { description: e.message });
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't start the agent";
      dispatch({ type: "error", message });
      toast.error("Couldn't start the agent", { description: message });
    }
  }, [meetingId, refetchEverything]);

  return { ...state, start, running: state.phase === "starting" || state.phase === "streaming" };
}

export type AgentRun = ReturnType<typeof useAgentRun>;
