"use client";

import { ArrowRight, Check, Flag, GitCompareArrows, History } from "lucide-react";
import Link from "next/link";
import { Chip } from "@/components/chip";
import { CARD_BASE, CARD_INTERACTIVE, useQuoteTarget, type QuoteHandler } from "@/components/meeting/use-quote-target";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/format";
import { useIssueAction } from "@/lib/mutations";
import type { ConflictIssue } from "@/lib/types";
import { cn } from "@/lib/utils";

const RESOLUTION_LABEL = {
  supersede: "Superseded by the newer decision",
  keep_old: "Kept the original decision",
  flag: "Flagged for discussion",
} as const;

/** Full card with before/after and actions, used in the meeting detail. */
export function ConflictCard({ issue, onQuote }: { issue: ConflictIssue; onQuote?: QuoteHandler }) {
  const { past, new: now, explanation, confidence } = issue.details;
  const act = useIssueAction();
  const target = useQuoteTarget(onQuote);
  const resolved = issue.status === "resolved";
  const flagged = issue.resolution === "flag";

  return (
    <article
      className={cn(CARD_BASE, "relative overflow-hidden border-conflict/20", onQuote && CARD_INTERACTIVE, resolved && "opacity-70")}
      {...target}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-conflict/60 to-transparent" />
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-conflict/10 text-conflict">
          <GitCompareArrows className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-snug">{issue.title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Conflict · {Math.round(confidence * 100)}% confidence</p>
        </div>
        {resolved && <Chip tone="emerald"><Check /> Resolved</Chip>}
        {flagged && !resolved && <Chip tone="amber"><Flag /> Flagged</Chip>}
      </div>

      <div className="mt-3.5 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        <Side label={`Before (${formatShortDate(past.held_at)})`} text={past.statement} muted />
        <ArrowRight className="hidden size-4 self-center text-muted-foreground sm:block" />
        <Side label={`Now (${formatShortDate(now.held_at)})`} text={now.statement} />
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{explanation}</p>

      {resolved && issue.resolution ? (
        <p className="mt-3 text-xs font-medium text-success">{RESOLUTION_LABEL[issue.resolution]}</p>
      ) : (
        <div className="mt-3.5 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ issue, action: "supersede" })}>
            Supersede
          </Button>
          <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ issue, action: "keep_old" })}>
            <History /> Keep old
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={act.isPending || flagged}
            onClick={() => act.mutate({ issue, action: "flag" })}
          >
            <Flag /> {flagged ? "Flagged" : "Flag"}
          </Button>
        </div>
      )}
    </article>
  );
}

function Side({ label, text, muted }: { label: string; text: string; muted?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2.5",
        muted ? "border-border bg-background/40" : "border-conflict/25 bg-conflict/[0.06]",
      )}
    >
      <div className={cn("text-[10.5px] font-medium uppercase tracking-wider", muted ? "text-muted-foreground" : "text-conflict")}>
        {label}
      </div>
      <p className={cn("mt-1 text-[13px] leading-snug", muted && "text-foreground/60 line-through decoration-foreground/20")}>
        {text}
      </p>
    </div>
  );
}

/** Compact dashboard row: old → new with meeting dates; links to the meeting. */
export function ConflictRow({ issue }: { issue: ConflictIssue }) {
  const { past, new: now } = issue.details;
  return (
    <Link
      href={issue.meeting_id !== undefined ? `/meetings/${issue.meeting_id}` : "/meetings"}
      className="group flex items-start gap-3 px-4 py-3 outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40"
    >
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-conflict/10 text-conflict">
        <GitCompareArrows className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{issue.title}</p>
        <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
          <span className="min-w-0 truncate text-muted-foreground line-through decoration-foreground/20">
            <span className="mr-1.5 font-mono text-[10.5px] no-underline">{formatShortDate(past.held_at)}</span>
            {past.statement}
          </span>
          <ArrowRight className="size-3 text-muted-foreground" />
          <span className="min-w-0 truncate text-foreground/90">
            <span className="mr-1.5 font-mono text-[10.5px] text-conflict">{formatShortDate(now.held_at)}</span>
            {now.statement}
          </span>
        </div>
      </div>
    </Link>
  );
}
