export interface Segment {
  id: number;
  meeting_id: number;
  speaker: string;
  text: string;
  ts_seconds: number | null;
}

export interface Meeting {
  id: number;
  title: string;
  held_at: string;
  participants: string[];
  segments?: Segment[];
}

export interface Decision {
  id: number;
  meeting_id: number;
  topic: string;
  statement: string;
  made_by: string | null;
  source_quote: string;
  ts_seconds: number | null;
  superseded_by: number | null;
}

export type TaskStatus = "open" | "in_progress" | "blocked" | "done";

export interface Task {
  id: number;
  meeting_id: number;
  title: string;
  owner: string | null;
  deadline_raw: string | null;
  deadline_date: string | null;
  deadline_confidence: "exact" | "inferred" | "vague" | "none";
  status: TaskStatus;
  source_quote: string;
}

export type IssueType =
  | "conflict"
  | "disagreement"
  | "vague_deadline"
  | "missing_owner";

export interface Issue {
  id: number;
  type: IssueType;
  meeting_id: number;
  summary: string;
  related_ids: number[];
  resolved: boolean;
}

export type ProposalKind = "notion_task" | "slack_message" | "email";
export type ProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "sent"
  | "failed";

export interface Proposal {
  id: number;
  kind: ProposalKind;
  status: ProposalStatus;
  meeting_id: number;
  title: string;
  payload: Record<string, unknown>;
  created_at: string;
}
