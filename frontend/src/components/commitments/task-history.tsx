import { Chip } from "@/components/chip";
import { formatShortDate } from "@/lib/format";
import type { CommitmentHistoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "start" | "push" | "done" | "blocked" | "neutral";

function describe(h: CommitmentHistoryItem): { text: string; vague: boolean; kind: Kind } {
  const dated = h.deadline ? formatShortDate(h.deadline) : null;
  const vague = !dated && Boolean(h.deadline_raw);
  const when = dated ?? (h.deadline_raw ? `“${h.deadline_raw}”` : null);
  switch (h.update_type) {
    case "committed":
      return { text: when ? `committed, due ${when}` : "committed", vague, kind: "start" };
    case "recommitted":
      return { text: when ? `pushed to ${when}` : "pushed back", vague, kind: "push" };
    case "completed":
      return { text: "completed", vague: false, kind: "done" };
    case "in_progress":
      return { text: "progress update", vague: false, kind: "neutral" };
    case "blocked":
      return { text: "blocked", vague: false, kind: "blocked" };
    case "not_mentioned":
      return { text: "not mentioned", vague: false, kind: "neutral" };
    default:
      return { text: h.update_type.replace(/_/g, " "), vague: false, kind: "neutral" };
  }
}

const DOT: Record<Kind, string> = {
  start: "border-primary bg-primary/30",
  push: "border-warning bg-warning/30",
  done: "border-success bg-success/30",
  blocked: "border-conflict bg-conflict/30",
  neutral: "border-border bg-surface-2",
};

/** A task's story across meetings, oldest first. */
export function TaskHistory({ history }: { history: CommitmentHistoryItem[] }) {
  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground">No updates recorded yet.</p>;
  }
  return (
    <ol className="relative">
      {history.map((h, i) => {
        const d = describe(h);
        const last = i === history.length - 1;
        return (
          <li key={`${h.held_at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span aria-hidden className="absolute left-[5px] top-4 h-[calc(100%-0.5rem)] w-px bg-border" />}
            <span aria-hidden className={cn("relative z-10 mt-1 size-[11px] shrink-0 rounded-full border-2", DOT[d.kind])} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-snug">
                <span className="font-mono text-[11.5px] text-muted-foreground">{formatShortDate(h.held_at)}</span>
                <span className="text-muted-foreground">—</span>
                <span className={cn(d.kind === "push" && "text-warning", d.kind === "done" && "text-success")}>{d.text}</span>
                {d.vague && <Chip tone="amber">vague</Chip>}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{h.meeting_title}</p>
              {h.quote && (
                <blockquote className="mt-1.5 border-l-2 border-border pl-2.5 text-xs italic leading-relaxed text-muted-foreground">
                  “{h.quote}”
                </blockquote>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
