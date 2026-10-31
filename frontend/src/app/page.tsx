"use client";

import { AlertTriangle, CalendarClock, CalendarDays, CheckCircle2, Download, ShieldCheck, TimerOff } from "lucide-react";
import Link from "next/link";
import { ConflictRow } from "@/components/conflict-card";
import { DeadlineRow } from "@/components/dashboard/deadline-row";
import { EmptyState } from "@/components/empty-state";
import { countIssues, MeetingRow } from "@/components/meeting/meeting-row";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useImportDialog } from "@/components/wispr/import-dialog";
import { plural } from "@/lib/format";
import { useIssues, useMeetings, useProposals, useTasks } from "@/lib/queries";
import { useNow, useToday } from "@/lib/use-today";
import type { ConflictIssue } from "@/lib/types";

const ROWS = (n: number, h: string) => (
  <div className="divide-y divide-border">
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="space-y-2 px-4 py-3.5">
        <Skeleton className={h} />
        <Skeleton className="h-3 w-3/4" />
      </div>
    ))}
  </div>
);

function Greeting({ conflicts, vague }: { conflicts: number | undefined; vague: number | undefined }) {
  const now = useNow();
  const hour = now?.getHours() ?? 12;
  const word = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const loaded = conflicts !== undefined && vague !== undefined;
  const attention = loaded ? conflicts + vague : 0;
  return (
    <div className="min-w-0">
      <h2 className="text-xl font-semibold leading-tight sm:text-2xl">
        {now ? `${word}, Shrey` : "Welcome back, Shrey"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {!loaded
          ? "Checking what needs your attention…"
          : attention > 0
            ? `${plural(conflicts, "conflict")} and ${plural(vague, "vague deadline")} need your attention.`
            : "Everything is on track. Nothing needs your attention."}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const importDialog = useImportDialog();
  const today = useToday();
  const meetings = useMeetings();
  const openIssues = useIssues("open");
  const proposals = useProposals("pending");
  const dueThisWeek = useTasks(7);
  const openTasks = useTasks();

  const conflicts = openIssues.data?.filter((i): i is ConflictIssue => i.type === "conflict");
  const vague = openIssues.data?.filter((i) => i.type === "vague_deadline").length;

  // Dated tasks first by date, then undated ones that keep slipping.
  const deadlines = openTasks.data
    ?.filter((t) => t.deadline || t.rollover_count > 0)
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))
    .slice(0, 6);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Greeting conflicts={conflicts?.length} vague={vague} />
        <Button size="lg" className="gap-1.5" onClick={importDialog.open}>
          <Download /> Import from Wispr
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Open conflicts"
          icon={AlertTriangle}
          tone="rose"
          value={conflicts?.length}
          loading={openIssues.isPending}
          hint="Decisions that contradict earlier ones"
        />
        <StatCard
          label="Vague deadlines"
          icon={TimerOff}
          tone="amber"
          value={vague}
          loading={openIssues.isPending}
          hint={'"Soon" is not a date'}
        />
        <StatCard
          label="Awaiting approval"
          icon={ShieldCheck}
          tone="violet"
          value={proposals.data?.length}
          loading={proposals.isPending}
          hint="Proposals in the review queue"
          href="/review"
        />
        <StatCard
          label="Due this week"
          icon={CalendarClock}
          tone="neutral"
          value={dueThisWeek.data?.length}
          loading={dueThisWeek.isPending}
          hint="Tasks with a deadline in 7 days"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <SectionCard
          title="Conflicts to resolve"
          count={conflicts?.length}
          className="lg:col-span-3"
        >
          {openIssues.isPending ? (
            ROWS(3, "h-4 w-2/3")
          ) : !conflicts || conflicts.length === 0 ? (
            <div className="p-4">
              <EmptyState
                compact
                icon={CheckCircle2}
                title="No conflicts"
                description="New decisions are checked against everything you've decided before."
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conflicts.map((c) => (
                <ConflictRow key={c.id} issue={c} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Upcoming deadlines" count={deadlines?.length} className="lg:col-span-2">
          {openTasks.isPending || !today ? (
            ROWS(4, "h-4 w-1/2")
          ) : !deadlines || deadlines.length === 0 ? (
            <div className="p-4">
              <EmptyState compact icon={CalendarClock} title="No deadlines" description="Tasks with dates will show up here." />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {deadlines.map((t) => (
                <DeadlineRow key={t.id} task={t} today={today} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recent meetings"
        action={
          <Link href="/meetings" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            View all
          </Link>
        }
      >
        {meetings.isPending ? (
          ROWS(3, "h-4 w-56 max-w-full")
        ) : !meetings.data || meetings.data.length === 0 ? (
          <div className="p-4">
            <EmptyState
              compact
              icon={CalendarDays}
              title="No meetings yet"
              description="Import a recording from Wispr Notetaker to get started."
              action="Import from Wispr"
              onAction={importDialog.open}
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {meetings.data.slice(0, 4).map((m) => (
              <MeetingRow key={m.id} meeting={m} counts={countIssues(openIssues.data, m.id)} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
