import { formatShortDate } from "@/lib/format";
import type { BriefHistoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUPERSEDED = /\s*\(superseded\)\s*$/i;

/** Compact decision history: old values struck through, the current one highlighted. Stacks on phones. */
export function MiniTimeline({ history }: { history: BriefHistoryItem[] }) {
  if (history.length === 0) return null;
  const last = history.length - 1;

  return (
    <ol className="grid sm:grid-flow-col sm:auto-cols-fr" aria-label="Decision history">
      {history.map((h, i) => {
        // Only the final entry can be the current one, and only if it isn't marked superseded.
        const current = i === last && !SUPERSEDED.test(h.statement);
        const statement = h.statement.replace(SUPERSEDED, "");
        return (
          <li key={`${h.date}-${i}`} className="relative flex gap-3 pb-4 last:pb-0 sm:block sm:pb-0 sm:pr-3">
            {i < last && (
              <span
                aria-hidden
                className="absolute left-[5px] top-4 h-[calc(100%-0.5rem)] w-px bg-border sm:left-4 sm:top-[5px] sm:h-px sm:w-[calc(100%-1.25rem)]"
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-1 size-[11px] shrink-0 rounded-full border-2 sm:mt-0",
                current ? "border-primary bg-primary shadow-[0_0_0_4px_rgba(124,108,255,0.18)]" : "border-border bg-surface-2",
              )}
            />
            <div className="min-w-0 sm:mt-2.5">
              <div className={cn("font-mono text-[10.5px]", current ? "text-[#a89fff]" : "text-muted-foreground")}>
                {formatShortDate(h.date)}
              </div>
              <p
                className={cn(
                  "mt-0.5 text-[12.5px] leading-snug",
                  current
                    ? "font-medium text-foreground"
                    : "text-muted-foreground line-through decoration-foreground/25",
                )}
              >
                {statement}
              </p>
              <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground/70">{h.meeting_title}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
