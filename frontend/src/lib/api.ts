import { API_URL, USE_MOCKS } from "./config";
import type {
  ImportWisprBody,
  ImportWisprResult,
  Issue,
  IssueAction,
  IssueType,
  MeetingDetail,
  MeetingSummary,
  ConfirmResult,
  Proposal,
  ReviewAction,
  VoiceCommandResult,
  Task,
  WisprMeeting,
} from "./types";

export { API_URL, USE_MOCKS };

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Thrown when the backend cannot be reached at all (network down, CORS, refused). */
export class NetworkError extends Error {
  constructor(message = "Cannot reach the FollowThrough API") {
    super(message);
    this.name = "NetworkError";
  }
}

export async function api<T>(
  path: string,
  init: Omit<RequestInit, "body"> & { json?: unknown } = {},
): Promise<T> {
  if (USE_MOCKS) return mockRequest<T>(path, init);

  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
  } catch {
    throw new NetworkError();
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : res.statusText;
    throw new ApiError(detail || `Request failed (${res.status})`, res.status, data);
  }
  return data as T;
}

/** Mock mode: same paths and shapes, served from src/mocks (loaded lazily, never in real mode). */
async function mockRequest<T>(path: string, init: { method?: string; json?: unknown }): Promise<T> {
  const { mockApi, MockHttpError } = await import("@/mocks/handlers");
  try {
    return await mockApi<T>(path, init);
  } catch (e) {
    if (e instanceof MockHttpError) throw new ApiError(e.message, e.status);
    throw e;
  }
}

const qs = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};

/** One typed function per endpoint in the API contract. */
export const followthrough = {
  meetings: () => api<MeetingSummary[]>("/meetings"),
  meeting: (id: number) => api<MeetingDetail>(`/meetings/${id}`),
  process: (id: number) => api<{ run_id: string }>(`/meetings/${id}/process`, { method: "POST" }),
  issues: (p: { status?: string; type?: IssueType } = {}) => api<Issue[]>(`/issues${qs(p)}`),
  patchIssue: (id: number, action: IssueAction) =>
    api<Issue>(`/issues/${id}`, { method: "PATCH", json: { action } }),
  tasks: (p: { due_within_days?: number } = {}) => api<Task[]>(`/tasks${qs(p)}`),
  proposals: (p: { status?: string } = {}) => api<Proposal[]>(`/proposals${qs(p)}`),
  patchProposal: (id: number, body: { payload?: Record<string, unknown>; status?: "pending" | "rejected" }) =>
    api<Proposal>(`/proposals/${id}`, { method: "PATCH", json: body }),
  voiceCommand: (text: string) =>
    api<VoiceCommandResult>("/proposals/voice-command", { method: "POST", json: { text } }),
  confirmProposals: (actions: ReviewAction[]) =>
    api<ConfirmResult>("/proposals/confirm", { method: "POST", json: { actions } }),
  wisprMeetings: () => api<WisprMeeting[]>("/wispr/meetings"),
  importWispr: (body: ImportWisprBody) =>
    api<ImportWisprResult>("/meetings/import/wispr", { method: "POST", json: body }),
};
