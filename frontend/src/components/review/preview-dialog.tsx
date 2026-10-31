"use client";

import { ArrowRight, Check, LoaderCircle, Send, TriangleAlert, X } from "lucide-react";
import { Chip } from "@/components/chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { numberOf, proposalHeadline, type ChangeRow } from "@/lib/review";

export function PreviewDialog({
  open,
  onOpenChange,
  preview,
  warnings,
  rows,
  confirming,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: string;
  warnings: string[];
  rows: ChangeRow[];
  confirming: boolean;
  onConfirm: () => void;
}) {
  const canConfirm = rows.length > 0 && !confirming;
  return (
    <Dialog open={open} onOpenChange={(o) => !confirming && onOpenChange(o)}>
      <DialogContent className="gap-5 p-5 sm:max-w-xl" showCloseButton={!confirming}>
        <DialogHeader className="gap-2">
          <DialogTitle className="sr-only">Preview</DialogTitle>
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">Here&apos;s what will happen</p>
          <DialogDescription className="text-xl font-medium leading-snug tracking-tight text-foreground">
            {preview || "No changes."}
          </DialogDescription>
        </DialogHeader>

        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((w) => (
              <div key={w} className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning" role="alert">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <ul className="max-h-[40vh] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-background/50">
            {rows.map(({ proposal, changes, decision }) => (
              <li key={proposal.id} className="flex items-start gap-3 px-3 py-2.5">
                <span className="mt-px w-7 shrink-0 font-mono text-[13px] font-semibold text-primary">#{numberOf(proposal)}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate text-[13px] font-medium">{proposalHeadline(proposal)}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {changes.map((c) => (
                      <span key={c.label} className="inline-flex max-w-full items-center gap-1.5 text-muted-foreground">
                        <span className="text-muted-foreground/70">{c.label}</span>
                        <span className={c.before ? "" : "italic opacity-70"}>{c.before ?? (c.label === "Text" ? "" : c.label === "Owner" ? "no owner" : "no date")}</span>
                        {(c.before || c.label !== "Text") && <ArrowRight className="size-3 shrink-0 opacity-60" />}
                        <span className="truncate font-medium text-foreground">{c.after}</span>
                      </span>
                    ))}
                    {decision === "approve" && <Chip tone="emerald"><Check /> Approve &amp; send</Chip>}
                    {decision === "reject" && <Chip tone="rose"><X /> Reject</Chip>}
                    {!decision && <Chip>Stays pending</Chip>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="-mx-5 -mb-5 flex-row justify-end gap-2 rounded-b-xl border-t border-border bg-surface-2/60 px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={confirming}>
            Edit
          </Button>
          <Button onClick={onConfirm} disabled={!canConfirm} className="gap-1.5 bg-primary px-3.5">
            {confirming ? <LoaderCircle className="animate-spin" /> : <Send />}
            {confirming ? "Sending…" : "Confirm & send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
