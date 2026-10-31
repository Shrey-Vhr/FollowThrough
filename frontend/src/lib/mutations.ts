"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { followthrough as ft } from "./api";
import { keys } from "./queries";
import type { BriefBody, Issue, IssueAction, MeetingDetail, ReviewAction } from "./types";

const TOASTS: Record<IssueAction, { title: string; description: string }> = {
  supersede: { title: "Marked as superseded", description: "The newer decision now replaces the old one." },
  keep_old: { title: "Keeping the original decision", description: "The conflicting statement was dismissed." },
  flag: { title: "Flagged for discussion", description: "It stays open so it comes up next meeting." },
};

/** Resolve or flag an issue. Optimistic: the UI and toast update immediately, rolling back on failure. */
export function useIssueAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issue, action }: { issue: Issue; action: IssueAction }) => ft.patchIssue(issue.id, action),
    onMutate: async ({ issue, action }) => {
      const key = issue.meeting_id !== undefined ? keys.meeting(issue.meeting_id) : null;
      const previous = key ? qc.getQueryData<MeetingDetail>(key) : undefined;
      if (key && previous) {
        qc.setQueryData<MeetingDetail>(key, {
          ...previous,
          issues: previous.issues.map((i) =>
            i.id === issue.id
              ? { ...i, resolution: action, status: action === "flag" ? i.status : "resolved" }
              : i,
          ),
        });
      }
      toast.success(TOASTS[action].title, { description: TOASTS[action].description });
      return { key, previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.key && ctx.previous) qc.setQueryData(ctx.key, ctx.previous);
      toast.error("Couldn't update the issue", { description: err.message });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["meeting"] });
      void qc.invalidateQueries({ queryKey: ["issues"] });
    },
  });
}

/** Edit a pending proposal's payload (owner, due date, text). */
export function usePatchProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      ft.patchProposal(id, { payload }),
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (err) => toast.error("Couldn't save the change", { description: err.message }),
  });
}

/** Turn a dictated command into review actions. Nothing is executed. */
export function useVoiceCommand() {
  return useMutation({
    mutationFn: (text: string) => ft.voiceCommand(text),
    onError: (err) => toast.error("Couldn't understand that", { description: err.message }),
  });
}

/** Apply the actions: the backend resumes the run and sends what was approved. */
export function useConfirmProposals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (actions: ReviewAction[]) => ft.confirmProposals(actions),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["proposals"] }),
    onError: (err) => toast.error("Couldn't send", { description: err.message }),
  });
}

/** Build a brief from a typed or dictated agenda. */
export function useCreateBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BriefBody) => ft.createBrief(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.briefs }),
  });
}

/** Draft one digest email per person into the Review Queue. Nothing is sent. */
export function useRunDigest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ft.runDigest(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["proposals"] }),
  });
}
