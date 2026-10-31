"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface Reminder {
  task: string;
  text: string;
  ok: boolean;
}

/** Demo-only: jump the app clock to Nov 28 and fire the reminder job, or put the clock back. */
export function SimulateTime() {
  const [busy, setBusy] = useState(false);

  const jump = async () => {
    setBusy(true);
    try {
      await api("/dev/fast-forward", { method: "POST", json: { to: "2026-11-28T08:00:00+05:30" } });
      const { sent } = await api<{ sent: Reminder[] }>("/dev/run-reminders", { method: "POST" });
      const ok = sent.filter((r) => r.ok);
      if (ok.length === 0) toast.info("Jumped to Nov 28 — no reminders were due");
      else for (const r of ok) toast.success(`Reminder sent to Slack: '${r.task}' is due today`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not simulate time");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    try {
      await api("/dev/fast-forward", { method: "POST", json: { reset: true } });
      toast.success("Time reset");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset time");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="sm" onClick={jump} disabled={busy}>
        ⏩ Jump to Nov 28
      </Button>
      <button type="button" onClick={reset} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
        Reset time
      </button>
    </div>
  );
}
