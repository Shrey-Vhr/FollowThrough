// Mirrors the backend API contract exactly. Fields marked "extension" are optional extras the
// UI uses when present (the backend should add them to /issues and /tasks).

export type MeetingSource = "wispr" | "upload" | "manual" | (string & {});
export type MeetingStatus = "imported" | "processing" | "processed" | (string & {});

export interface MeetingSummary {
  id: number;
  title: string;
  held_at: string;
  source: MeetingSource;
  status: MeetingStatus;
}

export interface Segment {
  id: number;
  speaker: string;
  person_id: number | null;
  text: string;
}

export interface Decision {
  id: number;
  topic: string;
  statement: string;
  made_by: string | null;
  source_quote: string;
  status: "active" | "superseded" | (string & {});
}

export type TaskStatus = "open" | "in_progress" | "blocked" | "completed";
export type DeadlineConfidence = "exact" | "inferred" | "vague" | "none";

export interface Task {
  id: number;
  title: string;
  owner_id: number | null;
  owner_name: string | null;
  deadline: string | null;
  deadline_raw: string | null;
  deadline_confidence: DeadlineConfidence;
  status: TaskStatus;
  rollover_count: number;
  source_quote: string;
  /** extension: needed to link from cross-meeting lists */
  meeting_id?: number;
}

export type IssueType = "conflict" | "disagreement" | "vague_deadline" | "missing_owner";

export interface DecisionView {
  statement: string;
  meeting_title: string;
  held_at: string;
  /** extension: lets the conflict card highlight the transcript line */
  source_quote?: string;
}

export interface ConflictDetails {
  /** extension: the ledger topic this conflict belongs to, so rows can deep-link to /ledger */
  topic?: string;
  new: DecisionView;
  past: DecisionView;
  explanation: string;
  confidence: number;
}
export interface VagueDeadlineDetails {
  task_title: string;
  owner: string | null;
  deadline_raw: string | null;
}
export interface MissingOwnerDetails {
  task_title: string;
  deadline_raw: string | null;
}
export interface DisagreementDetails {
  topic: string;
  positions: { person: string; view: string }[];
  source_quote: string;
}

export interface IssueBase {
  id: number;
  title: string;
  status: "open" | "resolved" | (string & {});
  /** extension */
  meeting_id?: number;
  meeting_title?: string;
  resolution?: IssueAction | null;
}
export type Issue =
  | (IssueBase & { type: "conflict"; details: ConflictDetails })
  | (IssueBase & { type: "vague_deadline"; details: VagueDeadlineDetails })
  | (IssueBase & { type: "missing_owner"; details: MissingOwnerDetails })
  | (IssueBase & { type: "disagreement"; details: DisagreementDetails });

export type ConflictIssue = Extract<Issue, { type: "conflict" }>;
export type IssueAction = "supersede" | "keep_old" | "flag";

export interface MeetingDetail extends MeetingSummary {
  wispr_summary: string | null;
  segments: Segment[];
  decisions: Decision[];
  tasks: Task[];
  issues: Issue[];
}

export type ProposalKind = "notion_task" | "slack_message" | "email";
export type ProposalStatus = "pending" | "approved" | "rejected" | "sent" | "failed" | "superseded";

/** Outcome of sending a proposal. The mock adds a link; the real executor returns an external id. */
export interface ProposalResult {
  ok: boolean;
  external_id?: string | null;
  url?: string | null;
  error?: string | null;
}

export interface Proposal {
  /** Real id: what the API takes and returns in actions. */
  id: number;
  run_id?: string | null;
  meeting_id?: number | null;
  kind: ProposalKind;
  /** notion_task {title, owner, due_date}; slack_message {channel|user, text}; email {to, subject, body} */
  payload: Record<string, unknown>;
  status: ProposalStatus;
  summary: string;
  result?: ProposalResult | null;
  /** 1..N among pending proposals, in id order: the number the user sees and speaks. Null when not pending. */
  display_no?: number | null;
}

export type ReviewActionKind = "approve" | "reject" | "reassign" | "set_deadline" | "edit_text";

/** One review action. Same shape for button clicks and voice commands. */
export interface ReviewAction {
  action: ReviewActionKind;
  proposal_ids: number[];
  to?: string | null;
  date?: string | null;
  text?: string | null;
}

export interface VoiceCommandResult {
  actions: ReviewAction[];
  preview: string;
  warnings: string[];
}

export interface ConfirmResult {
  proposals: Proposal[];
  preview: string;
}

export interface WisprMeeting {
  wispr_meeting_id: string;
  title: string;
  start: string;
  has_transcript: boolean;
  summary_excerpt: string | null;
  already_imported: boolean;
}

export interface ImportWisprBody {
  wispr_meeting_id: string;
  title?: string;
  held_at?: string;
}
export interface ImportWisprResult {
  meeting_id: number;
  segments: number;
}

export interface RunEvent {
  node: string;
  status: "running" | "done" | "error" | (string & {});
  message: string;
  data?: Record<string, unknown>;
}

// ---- Briefs ---------------------------------------------------------------

export interface BriefHistoryItem {
  date: string;
  meeting_title: string;
  statement: string;
}

export interface BriefTask {
  title: string;
  owner: string | null;
  deadline: string | null;
  status: string;
  rollover_count: number;
}

export interface BriefTopic {
  topic: string;
  current_decision: string | null;
  history: BriefHistoryItem[];
  open_conflicts: string[];
  open_tasks: BriefTask[];
  unresolved: string[];
  suggested_questions: string[];
}

export interface Brief {
  id: number | string;
  headline: string;
  topics: BriefTopic[];
  /** extensions: present on saved briefs when the backend stores them */
  agenda?: string | null;
  meeting_at?: string | null;
  created_at?: string | null;
}

export interface BriefBody {
  agenda: string;
  meeting_at?: string;
}

export interface DigestResult {
  proposals_created: number;
  proposal_ids: number[];
}

// ---- Commitments ----------------------------------------------------------

export type TaskUpdateType =
  | "committed"
  | "recommitted"
  | "in_progress"
  | "blocked"
  | "completed"
  | "not_mentioned"
  | (string & {});

export interface CommitmentHistoryItem {
  meeting_title: string;
  held_at: string;
  update_type: TaskUpdateType;
  quote: string | null;
  /** extensions: what the deadline was at that point, when the backend records it */
  deadline?: string | null;
  deadline_raw?: string | null;
}

export interface CommitmentTask {
  id: number | string;
  title: string;
  status: TaskStatus;
  deadline: string | null;
  deadline_raw: string | null;
  rollover_count: number;
  overdue?: boolean;
  history: CommitmentHistoryItem[];
}

export interface Commitment {
  person_id: number | string;
  name: string;
  committed: number;
  completed: number;
  open: number;
  overdue: number;
  total_rollovers: number;
  /** 0..1 */
  follow_through_rate: number;
  tasks: CommitmentTask[];
}

// ---- Decision ledger ------------------------------------------------------

export interface LedgerDecision {
  id: number | string;
  statement: string;
  held_at: string;
  meeting_title: string;
  /** "current" | "superseded" | ... */
  status?: string;
  topic?: string;
  made_by?: string | null;
  source_quote?: string | null;
}

export interface LedgerTopic {
  topic: string;
  current: LedgerDecision;
  history: LedgerDecision[];
  has_conflict: boolean;
}

export interface LedgerConflict {
  decision_id: number | string;
  related_decision_id: number | string;
  title?: string;
  /** extensions: what changed, e.g. "Nov 15" and "Nov 30" */
  old_value?: string;
  new_value?: string;
  explanation?: string;
}

export interface LedgerLineage {
  decision_id: number | string;
  topic: string;
  chain: LedgerDecision[];
  conflicts: LedgerConflict[];
}
