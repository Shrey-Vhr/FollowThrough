"use client";

import { useQuery } from "@tanstack/react-query";
import { followthrough as ft } from "./api";
import type { IssueType } from "./types";

export const keys = {
  meetings: ["meetings"] as const,
  meeting: (id: number) => ["meeting", id] as const,
  issues: (status?: string, type?: IssueType) => ["issues", status ?? "all", type ?? "all"] as const,
  tasks: (days?: number) => ["tasks", days ?? "all"] as const,
  proposals: (status?: string) => ["proposals", status ?? "all"] as const,
  wispr: ["wispr-meetings"] as const,
};

export const useMeetings = () => useQuery({ queryKey: keys.meetings, queryFn: ft.meetings });

export const useMeeting = (id: number) =>
  useQuery({ queryKey: keys.meeting(id), queryFn: () => ft.meeting(id), enabled: Number.isFinite(id) });

export const useIssues = (status?: string, type?: IssueType) =>
  useQuery({ queryKey: keys.issues(status, type), queryFn: () => ft.issues({ status, type }) });

export const useTasks = (due_within_days?: number) =>
  useQuery({ queryKey: keys.tasks(due_within_days), queryFn: () => ft.tasks({ due_within_days }) });

export const useProposals = (status?: string) =>
  useQuery({ queryKey: keys.proposals(status), queryFn: () => ft.proposals({ status }) });

export const useWisprMeetings = (enabled: boolean) =>
  useQuery({ queryKey: keys.wispr, queryFn: ft.wisprMeetings, enabled, staleTime: 0 });
