"use client";

import { useQuery } from "@tanstack/react-query";
import { followthrough as ft } from "./api";
import type { Brief, IssueType } from "./types";

export const keys = {
  meetings: ["meetings"] as const,
  meeting: (id: number | string) => ["meeting", id] as const,
  issues: (status?: string, type?: IssueType) => ["issues", status ?? "all", type ?? "all"] as const,
  tasks: (days?: number) => ["tasks", days ?? "all"] as const,
  proposals: (status?: string) => ["proposals", status ?? "all"] as const,
  wispr: ["wispr-meetings"] as const,
  briefs: ["briefs"] as const,
  commitments: ["commitments"] as const,
  ledger: ["ledger"] as const,
  lineage: (id: number | string) => ["lineage", String(id)] as const,
};

export const useMeetings = () => useQuery({ queryKey: keys.meetings, queryFn: ft.meetings });

export const useMeeting = (id: number | string) =>
  useQuery({ queryKey: keys.meeting(id), queryFn: () => ft.meeting(id), enabled: id !== "" && !Number.isNaN(id) });

export const useIssues = (status?: string, type?: IssueType) =>
  useQuery({ queryKey: keys.issues(status, type), queryFn: () => ft.issues({ status, type }) });

export const useTasks = (due_within_days?: number) =>
  useQuery({ queryKey: keys.tasks(due_within_days), queryFn: () => ft.tasks({ due_within_days }) });

export const useProposals = (status?: string) =>
  useQuery({ queryKey: keys.proposals(status), queryFn: () => ft.proposals({ status }) });

export const useWisprMeetings = (enabled: boolean) =>
  useQuery({ queryKey: keys.wispr, queryFn: ft.wisprMeetings, enabled, staleTime: 0 });

export const useBriefs = () => useQuery({ queryKey: keys.briefs, queryFn: ft.briefs });

export const useCommitments = () => useQuery({ queryKey: keys.commitments, queryFn: ft.commitments });

export const useLedger = () => useQuery({ queryKey: keys.ledger, queryFn: () => ft.ledger() });

export const useLineage = (decisionId: number | string | undefined) =>
  useQuery({
    queryKey: keys.lineage(decisionId ?? "none"),
    queryFn: () => ft.lineage(decisionId as number | string),
    enabled: decisionId !== undefined,
    // The ledger already shows the chain; losing connector detail isn't worth an error state.
    retry: false,
  });

export const useBrief = (id: number | string | undefined, initialData?: Brief) =>
  useQuery({
    queryKey: ["brief", String(id)] as const,
    queryFn: () => ft.brief(id as number | string),
    enabled: id !== undefined,
    initialData,
  });
