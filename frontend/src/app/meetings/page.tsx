"use client";

import { CalendarDays, Download } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { countIssues, MeetingRow } from "@/components/meeting/meeting-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useImportDialog } from "@/components/wispr/import-dialog";
import { useIssues, useMeetings } from "@/lib/queries";

export default function MeetingsPage() {
  const meetings = useMeetings();
  const issues = useIssues("open");
  const importDialog = useImportDialog();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {meetings.data ? `${meetings.data.length} meetings` : "Loading meetings…"}
        </p>
        <Button size="lg" className="gap-1.5" onClick={importDialog.open}>
          <Download /> Import from Wispr
        </Button>
      </div>

      {meetings.isPending ? (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2.5 px-4 py-3.5">
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-5 w-72 max-w-full" />
            </div>
          ))}
        </div>
      ) : meetings.isError || meetings.data.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={meetings.isError ? "Couldn't load meetings" : "No meetings yet"}
          description={
            meetings.isError
              ? "The API didn't respond. Check that the backend is running."
              : "Import a transcript from Wispr Notetaker and FollowThrough will extract decisions and tasks."
          }
          action={meetings.isError ? "Retry" : "Import from Wispr"}
          onAction={meetings.isError ? () => void meetings.refetch() : importDialog.open}
        />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {meetings.data.map((m) => (
            <MeetingRow key={m.id} meeting={m} counts={countIssues(issues.data, m.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
