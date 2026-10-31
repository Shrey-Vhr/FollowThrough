import { CalendarDays, Repeat2, UserX } from "lucide-react";
import { Chip } from "@/components/chip";
import { CARD_BASE, CARD_INTERACTIVE, useQuoteTarget, type QuoteHandler } from "@/components/meeting/use-quote-target";
import { PersonAvatar } from "@/components/speaker-chip";
import { StatusPill } from "@/components/status-pill";
import { formatShortDate } from "@/lib/format";
import { resolvePerson } from "@/lib/people";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RolloverBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <Chip tone={count >= 2 ? "amber" : "neutral"}>
      <Repeat2 /> pushed {count}×
    </Chip>
  );
}

export function DeadlineChip({ task }: { task: Pick<Task, "deadline" | "deadline_raw" | "deadline_confidence"> }) {
  const vague = task.deadline_confidence === "vague" || (!task.deadline && task.deadline_raw);
  if (vague) {
    return (
      <Chip tone="amber">
        <CalendarDays /> Vague{task.deadline_raw ? `: ${task.deadline_raw}` : ""}
      </Chip>
    );
  }
  if (task.deadline) {
    return (
      <Chip>
        <CalendarDays /> {formatShortDate(task.deadline)}
        {task.deadline_confidence === "inferred" && <span className="opacity-60">· approx.</span>}
      </Chip>
    );
  }
  return (
    <Chip className="border-dashed">
      <CalendarDays /> No deadline
    </Chip>
  );
}

export function TaskCard({ task, onQuote }: { task: Task; onQuote?: QuoteHandler }) {
  const target = useQuoteTarget(onQuote);
  const done = task.status === "completed";
  return (
    <article className={cn(CARD_BASE, onQuote && CARD_INTERACTIVE)} {...target}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-sm font-medium leading-snug", done && "text-foreground/50 line-through")}>
            {task.title}
          </h3>
        </div>
        <StatusPill status={task.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {task.owner_name ? (
          <span className="inline-flex items-center gap-1.5 pr-1 text-xs text-muted-foreground">
            <PersonAvatar name={task.owner_name} />
            {resolvePerson(task.owner_name).name}
          </span>
        ) : (
          <Chip tone="rose">
            <UserX /> No owner
          </Chip>
        )}
        <DeadlineChip task={task} />
        <RolloverBadge count={task.rollover_count} />
      </div>
    </article>
  );
}
