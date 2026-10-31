import { API_URL, USE_MOCKS } from "./config";
import type { RunEvent } from "./types";

export interface RunStreamHandlers {
  onEvent: (event: RunEvent) => void;
  /** Called if the connection fails before the run reached human review. */
  onError: (error: Error) => void;
}

/**
 * Subscribes to GET /runs/{run_id}/stream (Server-Sent Events). Returns an unsubscribe function.
 * The stream is closed as soon as the run pauses at human_review, so EventSource doesn't reconnect.
 */
export function subscribeToRun(runId: string, meetingId: number, handlers: RunStreamHandlers): () => void {
  if (USE_MOCKS) {
    let stop = () => {};
    void import("@/mocks/stream").then(({ mockRunStream }) => {
      stop = mockRunStream(runId, meetingId, handlers);
    });
    return () => stop();
  }

  const source = new EventSource(`${API_URL}/runs/${encodeURIComponent(runId)}/stream`);
  let finished = false;
  source.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data) as RunEvent;
      handlers.onEvent(event);
      if (event.node === "human_review") {
        finished = true;
        source.close();
      }
    } catch {
      /* ignore malformed keep-alives */
    }
  };
  source.onerror = () => {
    if (finished) return;
    source.close();
    handlers.onError(new Error("Lost connection to the agent stream"));
  };
  return () => {
    finished = true;
    source.close();
  };
}
