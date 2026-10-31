"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CalendarDays, Check, Copy, GitCompareArrows, HelpCircle, MessageCircleQuestion, UserX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Chip } from "@/components/chip";
import { PersonAvatar } from "@/components/speaker-chip";
import { RolloverBadge } from "@/components/task-card";
import { copyText } from "@/lib/clipboard";
import { formatShortDate } from "@/lib/format";
import { resolvePerson } from "@/lib/people";
import type { BriefTask, BriefTopic } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MiniTimeline } from "./mini-timeline";

const ISO = /^\d{4}-\d{2}-\d{2}/;

function TaskDeadline({ deadline }: { deadline: string | null }) {
  if (!deadline)
    return (
      <Chip className="border-dashed">
        <CalendarDays /> No deadline
      </Chip>
    );
  if (ISO.test(deadline))
    return (
      <Chip>
        <CalendarDays /> {formatShortDate(deadline)}
      </Chip>
    );
  return (
    <Chip tone="amber">
      <CalendarDays /> Vague: {deadline}
    </Chip>
  );
}

function TaskRow({ task }: { task: BriefTask }) {
  const done = task.status === "completed";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <span className={cn("min-w-0 flex-1 basis-48 text-[13px] font-medium leading-snug", done && "text-foreground/50 line-through")}>
        {task.title}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {task.owner ? (
          <span className="inline-flex items-center gap-1.5 pr-1 text-xs text-muted-foreground">
            <PersonAvatar name={task.owner} />
            {resolvePerson(task.owner).name}
          </span>
        ) : (
          <Chip tone="rose">
            <UserX /> No owner
          </Chip>
        )}
        <TaskDeadline deadline={task.deadline} />
        <RolloverBadge count={task.rollover_count} />
      </div>
    </li>
  );
}

function Label({ children, tone }: { children: React.ReactNode; tone?: "rose" | "amber" | "violet" }) {
  return (
    <h4
      className={cn(
        "mb-2 text-[10.5px] font-semibold uppercase tracking-wider",
        tone === "rose" && "text-conflict",
        tone === "amber" && "text-warning",
        tone === "violet" && "text-[#a89fff]",
        !tone && "text-muted-foreground",
      )}
    >
      {children}
    </h4>
  );
}

function QuestionRow({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    if (await copyText(text, "Question copied")) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <li className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-primary/[0.06]">
      <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-[#a89fff]" />
      <span className="min-w-0 flex-1 text-[13px] leading-snug">{text}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy question: ${text}`}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
    </li>
  );
}

export function TopicCard({ topic: t, index }: { topic: BriefTopic; index: number }) {
  const reduce = useReducedMotion();
  const decided = t.current_decision !== null && t.current_decision !== "";

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: reduce ? 0 : 0.08 + index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-xl border border-border bg-surface"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
        <span className="font-mono text-[11px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t.topic}</h3>
        {t.open_conflicts.length > 0 && (
          <Chip tone="rose">
            <GitCompareArrows /> changed
          </Chip>
        )}
      </header>

      <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
        {/* current decision */}
        <div>
          <Label tone="violet">Current decision</Label>
          {decided ? (
            <p className="text-lg font-semibold leading-snug sm:text-xl">{t.current_decision}</p>
          ) : (
            <p className="flex items-center gap-2 text-base text-muted-foreground">
              <HelpCircle className="size-4 shrink-0" /> Nothing has been decided yet
            </p>
          )}
        </div>

        {t.history.length > 0 && (
          <div className="rounded-lg border border-border bg-background/30 px-4 py-3.5">
            <Label>How we got here</Label>
            <MiniTimeline history={t.history} />
          </div>
        )}

        {t.open_conflicts.length > 0 && (
          <div className="rounded-lg border border-conflict/25 bg-conflict/[0.06] px-4 py-3">
            <Label tone="rose">Open conflicts</Label>
            <ul className="space-y-1.5">
              {t.open_conflicts.map((c) => (
                <li key={c} className="flex items-start gap-2 text-[13px] leading-snug">
                  <GitCompareArrows className="mt-0.5 size-3.5 shrink-0 text-conflict" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {t.open_tasks.length > 0 && (
          <div>
            <Label>Open tasks</Label>
            <ul className="space-y-1.5">
              {t.open_tasks.map((k) => (
                <TaskRow key={k.title} task={k} />
              ))}
            </ul>
          </div>
        )}

        {t.unresolved.length > 0 && (
          <div className="rounded-lg border border-warning/20 bg-warning/[0.05] px-4 py-3">
            <Label tone="amber">Unresolved</Label>
            <ul className="space-y-1.5">
              {t.unresolved.map((u) => (
                <li key={u} className="flex items-start gap-2 text-[13px] leading-snug">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}

        {t.suggested_questions.length > 0 && (
          <div>
            <Label tone="violet">Ask in this meeting</Label>
            <ul className="-mx-2 space-y-0.5">
              {t.suggested_questions.map((q) => (
                <QuestionRow key={q} text={q} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.article>
  );
}
