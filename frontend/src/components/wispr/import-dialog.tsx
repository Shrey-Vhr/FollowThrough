"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Download, FileAudio, Loader2, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { followthrough as ft } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { keys, useWisprMeetings } from "@/lib/queries";
import type { WisprMeeting } from "@/lib/types";

const ImportDialogContext = createContext<{ open: () => void }>({ open: () => {} });

/** Any component can open the shared Wispr import dialog with `useImportDialog().open()`. */
export const useImportDialog = () => useContext(ImportDialogContext);

export function ImportDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <ImportDialogContext.Provider value={value}>
      {children}
      <ImportDialog open={isOpen} onOpenChange={setOpen} />
    </ImportDialogContext.Provider>
  );
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data, isPending, isError, refetch } = useWisprMeetings(open);
  const qc = useQueryClient();
  const router = useRouter();
  const [dates, setDates] = useState<Record<string, string>>({});

  const importMutation = useMutation({
    mutationFn: (w: WisprMeeting) =>
      ft.importWispr({
        wispr_meeting_id: w.wispr_meeting_id,
        title: w.title,
        held_at: dates[w.wispr_meeting_id] || w.start.slice(0, 10),
      }),
    onSuccess: (result, w) => {
      toast.success(`Imported "${w.title}"`, { description: `${result.segments} transcript lines ready to analyze.` });
      void qc.invalidateQueries({ queryKey: keys.meetings });
      void qc.invalidateQueries({ queryKey: keys.wispr });
      onOpenChange(false);
      router.push(`/meetings/${result.meeting_id}`);
    },
    onError: (err) => toast.error("Import failed", { description: err.message }),
  });
  const importingId = importMutation.isPending ? importMutation.variables.wispr_meeting_id : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border p-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Mic className="size-4 text-primary" /> Import from Wispr Notetaker
          </DialogTitle>
          <DialogDescription>Pick a recorded meeting. FollowThrough pulls its transcript and summary.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {isPending && (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          )}
          {isError && (
            <EmptyState
              compact
              icon={FileAudio}
              title="Couldn't reach Wispr"
              description="Check the connection and try again."
              action="Retry"
              onAction={() => void refetch()}
            />
          )}
          {data?.length === 0 && (
            <EmptyState compact icon={FileAudio} title="No recordings yet" description="Meetings recorded with Wispr Notetaker will show up here." />
          )}
          <ul className="space-y-1">
            {data?.map((w) => {
              const busy = importingId === w.wispr_meeting_id;
              return (
                <li key={w.wispr_meeting_id} className="rounded-lg p-3 transition-colors hover:bg-accent/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium">{w.title}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Recorded {formatDateTime(w.start)}</p>
                    </div>
                    {w.already_imported && (
                      <Chip tone="emerald">
                        <Check /> Imported
                      </Chip>
                    )}
                    {!w.has_transcript && !w.already_imported && <Chip tone="amber">Processing</Chip>}
                  </div>
                  {w.summary_excerpt && (
                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{w.summary_excerpt}</p>
                  )}
                  {!w.already_imported && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Meeting date
                        <Input
                          type="date"
                          value={dates[w.wispr_meeting_id] ?? w.start.slice(0, 10)}
                          onChange={(e) => setDates((d) => ({ ...d, [w.wispr_meeting_id]: e.target.value }))}
                          className="h-7 w-[9.5rem] bg-background px-2 text-xs"
                        />
                      </label>
                      <Button
                        size="sm"
                        className="ml-auto"
                        disabled={!w.has_transcript || importMutation.isPending}
                        onClick={() => importMutation.mutate(w)}
                      >
                        {busy ? <Loader2 className="animate-spin" /> : <Download />}
                        {busy ? "Importing…" : w.has_transcript ? "Import" : "Transcript not ready"}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
