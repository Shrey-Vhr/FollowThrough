"use client";

import { BookMarked, CheckCircle2, ListChecks, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ConflictCard } from "@/components/conflict-card";
import { DecisionCard } from "@/components/decision-card";
import { EmptyState } from "@/components/empty-state";
import { IssueCard } from "@/components/issue-card";
import { TaskCard } from "@/components/task-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Issue, MeetingDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { QuoteHandler } from "./use-quote-target";

type TabId = "decisions" | "tasks" | "issues";

function Count({ n, tone }: { n: number; tone?: "rose" }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 font-mono text-[11px] leading-[18px]",
        tone === "rose" && n > 0 ? "bg-conflict/15 text-conflict" : "bg-surface-2 text-muted-foreground",
      )}
    >
      {n}
    </span>
  );
}

const open = (i: Issue) => i.status !== "resolved";

/** Decisions / Tasks / Issues tabs with counts. */
export function InsightsPanel({
  meeting,
  quoteFor,
}: {
  meeting: MeetingDetail;
  quoteFor: (quote: string | null | undefined) => QuoteHandler | undefined;
}) {
  const { decisions, tasks, issues } = meeting;
  const [tab, setTab] = useState<TabId | null>(null);
  const active: TabId = tab ?? (issues.length > 0 ? "issues" : "decisions");
  const unanalyzed = decisions.length + tasks.length + issues.length === 0;

  // Conflicts first, then everything else; resolved ones sink to the bottom.
  const sorted = [...issues].sort(
    (a, b) => Number(!open(a)) - Number(!open(b)) || Number(b.type === "conflict") - Number(a.type === "conflict"),
  );

  return (
    <Tabs value={active} onValueChange={(v) => setTab(v as TabId)} className="min-w-0 gap-4">
      <TabsList variant="line" className="h-9 w-full justify-start border-b border-border pb-px">
        <TabsTrigger value="decisions" className="flex-none gap-2 px-3">
          Decisions <Count n={decisions.length} />
        </TabsTrigger>
        <TabsTrigger value="tasks" className="flex-none gap-2 px-3">
          Tasks <Count n={tasks.length} />
        </TabsTrigger>
        <TabsTrigger value="issues" className="flex-none gap-2 px-3">
          Issues <Count n={issues.filter(open).length} tone="rose" />
        </TabsTrigger>
      </TabsList>

      <TabsContent value="decisions" className="space-y-3">
        {decisions.length === 0 ? (
          <EmptyState compact icon={BookMarked} title={unanalyzed ? "Not analyzed yet" : "No decisions"} description={unanalyzed ? "Run the agent to extract decisions, tasks and issues from this transcript." : "No decisions were made in this meeting."} />
        ) : (
          decisions.map((d) => <DecisionCard key={d.id} decision={d} onQuote={quoteFor(d.source_quote)} />)
        )}
      </TabsContent>

      <TabsContent value="tasks" className="space-y-3">
        {tasks.length === 0 ? (
          <EmptyState compact icon={ListChecks} title={unanalyzed ? "Not analyzed yet" : "No tasks"} description={unanalyzed ? "Run the agent to turn commitments into tasks with owners and deadlines." : "Nobody committed to anything in this meeting."} />
        ) : (
          tasks.map((t) => <TaskCard key={t.id} task={t} onQuote={quoteFor(t.source_quote)} />)
        )}
      </TabsContent>

      <TabsContent value="issues" className="space-y-3">
        {sorted.length === 0 ? (
          <EmptyState compact icon={unanalyzed ? ShieldCheck : CheckCircle2} title={unanalyzed ? "Not analyzed yet" : "All clear"} description={unanalyzed ? "Run the agent to check this meeting for conflicts and gaps." : "No conflicts, vague deadlines or missing owners in this meeting."} />
        ) : (
          sorted.map((issue) =>
            issue.type === "conflict" ? (
              <ConflictCard
                key={issue.id}
                issue={issue}
                onQuote={quoteFor(issue.details.new.source_quote)}
              />
            ) : (
              <IssueCard
                key={issue.id}
                issue={issue}
                onQuote={quoteFor(issueQuote(issue, tasks))}
              />
            ),
          )
        )}
      </TabsContent>
    </Tabs>
  );
}

/** Vague/missing-owner issues point at the quote of the task they're about. */
function issueQuote(issue: Exclude<Issue, { type: "conflict" }>, tasks: MeetingDetail["tasks"]): string | undefined {
  if (issue.type === "disagreement") return issue.details.source_quote;
  return tasks.find((t) => t.title === issue.details.task_title)?.source_quote;
}
