import Link from "next/link";
import { RolloverBadge } from "@/components/task-card";
import { PersonAvatar } from "@/components/speaker-chip";
import { Chip } from "@/components/chip";
import { relativeDue } from "@/lib/format";
import { resolvePerson } from "@/lib/people";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DeadlineRow({ task, today }: { task: Task; today: Date }) {
  const due = task.deadline ? relativeDue(task.deadline, today) : null;
  return (
    <Link
      href={task.meeting_id !== undefined ? `/meetings/${task.meeting_id}` : "/meetings"}
      className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40"
    >
      {task.owner_name ? (
        <PersonAvatar name={task.owner_name} />
      ) : (
        <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-conflict/40 text-[10px] text-conflict">
          ?
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{task.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {task.owner_name ? resolvePerson(task.owner_name).name : "No owner"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {due ? (
          <span
            className={cn(
              "text-xs font-medium",
              due.tone === "overdue" && "text-conflict",
              due.tone === "soon" && "text-warning",
              due.tone === "normal" && "text-muted-foreground",
            )}
          >
            {due.label}
          </span>
        ) : (
          <Chip tone="amber">No date{task.deadline_raw ? `: ${task.deadline_raw}` : ""}</Chip>
        )}
        <RolloverBadge count={task.rollover_count} />
      </div>
    </Link>
  );
}
