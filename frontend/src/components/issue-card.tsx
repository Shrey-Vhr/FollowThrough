import { CalendarClock, Lightbulb, MessagesSquare, UserX, type LucideIcon } from "lucide-react";
import { Chip } from "@/components/chip";
import { CARD_BASE, CARD_INTERACTIVE, useQuoteTarget, type QuoteHandler } from "@/components/meeting/use-quote-target";
import { firstName } from "@/lib/people";
import type { Issue } from "@/lib/types";
import { cn } from "@/lib/utils";

const META: Record<Exclude<Issue["type"], "conflict">, { icon: LucideIcon; label: string; tone: string }> = {
  vague_deadline: { icon: CalendarClock, label: "Vague deadline", tone: "bg-warning/10 text-warning" },
  missing_owner: { icon: UserX, label: "Missing owner", tone: "bg-conflict/10 text-conflict" },
  disagreement: { icon: MessagesSquare, label: "Disagreement", tone: "bg-sky-400/10 text-sky-300" },
};

function suggestedFix(issue: Exclude<Issue, { type: "conflict" }>): string {
  switch (issue.type) {
    case "vague_deadline":
      return issue.details.owner
        ? `Ask ${firstName(issue.details.owner)} for a calendar date instead of "${issue.details.deadline_raw ?? "soon"}".`
        : "Ask the owner for a calendar date.";
    case "missing_owner":
      return "Assign an owner before the next sync. Proposals will nudge the team in Slack.";
    case "disagreement":
      return "Record the final call as a decision once the group settles.";
  }
}

/** Compact card for every issue type except conflicts (see ConflictCard). */
export function IssueCard({
  issue,
  onQuote,
}: {
  issue: Exclude<Issue, { type: "conflict" }>;
  onQuote?: QuoteHandler;
}) {
  const target = useQuoteTarget(onQuote);
  const meta = META[issue.type];
  const Icon = meta.icon;
  return (
    <article
      className={cn(CARD_BASE, onQuote && CARD_INTERACTIVE, issue.status === "resolved" && "opacity-60")}
      {...target}
    >
      <div className="flex items-start gap-2.5">
        <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md", meta.tone)}>
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-snug">{issue.title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{meta.label}</p>
        </div>
        {issue.status === "resolved" && <Chip tone="emerald">Resolved</Chip>}
      </div>

      {issue.type === "disagreement" && (
        <ul className="mt-3 space-y-1.5">
          {issue.details.positions.map((p) => (
            <li key={p.person} className="text-[13px] leading-snug text-muted-foreground">
              <span className="font-medium text-foreground/80">{firstName(p.person)}:</span> {p.view}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 flex gap-2 rounded-md bg-background/50 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <span>
          <span className="font-medium text-foreground/80">Suggested fix · </span>
          {suggestedFix(issue)}
        </span>
      </p>
    </article>
  );
}
