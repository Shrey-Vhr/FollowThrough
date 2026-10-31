"use client";

import { useReducedMotion } from "framer-motion";
import { ArrowLeft, CalendarDays, FileSearch, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentStepsSheet, useAgentRun } from "@/components/agent-steps";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { SourceBadge } from "@/components/source-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLongDate, plural } from "@/lib/format";
import { useMeeting } from "@/lib/queries";
import { findSegmentForQuote } from "@/lib/quote-match";
import type { MeetingDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { InsightsPanel } from "./insights-panel";
import { Transcript } from "./transcript";
import type { QuoteHandler } from "./use-quote-target";

const HIGHLIGHT_MS = 2000;

export function MeetingDetailView() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data, isPending, isError } = useMeeting(id);

  if (isPending) return <DetailSkeleton />;
  if (isError || !data) {
    return (
      <EmptyState
        icon={FileSearch}
        title="Meeting not found"
        description="It may have been removed, or the link is wrong."
        action="Back to meetings"
        href="/meetings"
      />
    );
  }
  return <Detail meeting={data} />;
}

function Detail({ meeting }: { meeting: MeetingDetail }) {
  const run = useAgentRun(meeting.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const reduce = useReducedMotion();

  const [activeId, setActiveId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const segmentEls = useRef(new Map<number, HTMLElement>());
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  const registerSegment = useCallback((segId: number, el: HTMLElement | null) => {
    if (el) segmentEls.current.set(segId, el);
    else segmentEls.current.delete(segId);
  }, []);

  /** Highlights (and scrolls to) the transcript line that best matches a quote. */
  const quoteFor = useCallback(
    (quote: string | null | undefined): QuoteHandler | undefined => {
      if (!quote) return undefined;
      return (reveal) => {
        const seg = findSegmentForQuote(meeting.segments, quote);
        if (!seg) return;
        setActiveId(seg.id);
        clearTimeout(fadeTimer.current);
        fadeTimer.current = setTimeout(() => setActiveId(null), HIGHLIGHT_MS);

        const behavior = reduce ? "auto" : "smooth";
        const el = segmentEls.current.get(seg.id);
        const box = scrollRef.current;
        if (!el || !box) return;
        box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior });
        // On stacked (mobile) layouts the transcript can be off-screen; bring it into view on click.
        if (reveal) el.scrollIntoView({ block: "nearest", behavior });
      };
    },
    [meeting.segments, reduce],
  );

  const openIssues = meeting.issues.filter((i) => i.status !== "resolved").length;
  const analyzed = meeting.decisions.length + meeting.tasks.length + meeting.issues.length > 0;

  const startRun = () => {
    setSheetOpen(true);
    // Reopening while a run is in progress (or finished) just shows it; otherwise start a new one.
    if (!run.running && run.phase !== "review") void run.start();
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href="/meetings"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Meetings
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight sm:text-2xl">{meeting.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" /> {formatLongDate(meeting.held_at)}
              </span>
              <SourceBadge source={meeting.source} />
              {analyzed ? (
                <Chip tone={openIssues > 0 ? "rose" : "emerald"}>
                  {openIssues > 0 ? plural(openIssues, "open issue") : "All clear"}
                </Chip>
              ) : (
                <Chip tone="amber">Not analyzed</Chip>
              )}
            </div>
          </div>
          <Button size="lg" className="gap-1.5" onClick={startRun}>
            {run.running ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {run.running ? "Agent running…" : run.phase === "review" ? "View agent run" : "Run agent"}
          </Button>
        </div>
        {meeting.wispr_summary && (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{meeting.wispr_summary}</p>
        )}
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section
          aria-label="Transcript"
          className={cn(
            "flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface",
            "h-[60dvh] lg:sticky lg:top-20 lg:h-[calc(100dvh-8rem)]",
          )}
        >
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            <h3 className="text-[13px] font-semibold">Transcript</h3>
            <span className="font-mono text-[11px] text-muted-foreground">{meeting.segments.length} lines</span>
          </div>
          <Transcript
            segments={meeting.segments}
            activeId={activeId}
            scrollRef={scrollRef}
            registerSegment={registerSegment}
          />
        </section>

        <InsightsPanel meeting={meeting} quoteFor={quoteFor} />
      </div>

      <AgentStepsSheet run={run} meetingTitle={meeting.title} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[60dvh] rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
