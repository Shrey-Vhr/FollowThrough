import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Chip } from "@/components/chip";
import { SourceBadge } from "@/components/source-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate, plural } from "@/lib/format";
import type { Issue, MeetingSummary } from "@/lib/types";

export interface IssueCounts {
  conflicts: number;
  gaps: number;
  disagreements: number;
}

export function countIssues(issues: Issue[] | undefined, meetingId: number): IssueCounts | undefined {
  if (!issues) return undefined;
  const mine = issues.filter((i) => i.meeting_id === meetingId && i.status !== "resolved");
  return {
    conflicts: mine.filter((i) => i.type === "conflict").length,
    gaps: mine.filter((i) => i.type === "vague_deadline" || i.type === "missing_owner").length,
    disagreements: mine.filter((i) => i.type === "disagreement").length,
  };
}

export function IssueChips({ counts }: { counts: IssueCounts | undefined }) {
  if (!counts) return <Skeleton className="h-5 w-24 rounded-full" />;
  const { conflicts, gaps, disagreements } = counts;
  if (conflicts + gaps + disagreements === 0) return <Chip tone="emerald">No open issues</Chip>;
  return (
    <>
      {conflicts > 0 && <Chip tone="rose">{plural(conflicts, "conflict")}</Chip>}
      {gaps > 0 && <Chip tone="amber">{plural(gaps, "gap")}</Chip>}
      {disagreements > 0 && <Chip tone="sky">{plural(disagreements, "disagreement")}</Chip>}
    </>
  );
}

/** Row used by both the dashboard's "Recent meetings" and the meetings list. */
export function MeetingRow({ meeting, counts }: { meeting: MeetingSummary; counts: IssueCounts | undefined }) {
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="group flex items-center gap-3 px-4 py-3.5 outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{meeting.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">{formatShortDate(meeting.held_at)}</span>
          <SourceBadge source={meeting.source} />
          {meeting.status === "imported" ? <Chip tone="amber">Not analyzed</Chip> : <IssueChips counts={counts} />}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
