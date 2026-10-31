"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { Chip } from "@/components/chip";
import { StatusPill } from "@/components/status-pill";
import { DeadlineChip, RolloverBadge } from "@/components/task-card";
import type { CommitmentTask } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TaskHistory } from "./task-history";

/** Maps the commitments task shape onto what DeadlineChip expects. */
function deadlineProps(t: CommitmentTask) {
  const vague = !t.deadline && Boolean(t.deadline_raw);
  return {
    deadline: t.deadline,
    deadline_raw: t.deadline_raw,
    deadline_confidence: t.deadline ? ("exact" as const) : vague ? ("vague" as const) : ("none" as const),
  };
}

export function TaskRow({ task }: { task: CommitmentTask }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const panel = useId();
  const done = task.status === "completed";

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panel}
        className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-accent/30 focus-visible:bg-accent/30"
      >
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-[13px] font-medium", done && "text-foreground/50 line-through")}>{task.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
            <StatusPill status={task.status} />
            {!done && <DeadlineChip task={deadlineProps(task)} />}
            <RolloverBadge count={task.rollover_count} />
            {task.overdue && <Chip tone="amber">overdue</Chip>}
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          {task.overdue && <Chip tone="amber">overdue</Chip>}
          <RolloverBadge count={task.rollover_count} />
          {!done && <DeadlineChip task={deadlineProps(task)} />}
          <StatusPill status={task.status} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panel}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pl-11 pt-1">
              <TaskHistory history={task.history} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
