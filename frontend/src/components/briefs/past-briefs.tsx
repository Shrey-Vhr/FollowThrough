"use client";

import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/lib/format";
import type { Brief } from "@/lib/types";
import { cn } from "@/lib/utils";

const titleOf = (b: Brief) => {
  const names = b.topics.map((t) => t.topic);
  if (names.length === 0) return "Untitled brief";
  return names.length > 3 ? `${names.slice(0, 3).join(" · ")} +${names.length - 3}` : names.join(" · ");
};

export function PastBriefs({
  briefs,
  loading,
  error,
  selectedId,
  onSelect,
  onNew,
  onRetry,
}: {
  briefs: Brief[] | undefined;
  loading: boolean;
  error: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRetry: () => void;
}) {
  return (
    <aside aria-label="Past briefs" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold">Past briefs</h2>
        <Button size="sm" variant={selectedId === null ? "secondary" : "outline"} onClick={onNew}>
          <Plus /> New brief
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border bg-surface p-3">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-border bg-surface p-3 text-[13px] text-muted-foreground">
          Couldn&apos;t load past briefs.{" "}
          <button type="button" onClick={onRetry} className="text-foreground underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !briefs || briefs.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border bg-surface/40 p-3 text-[13px] text-muted-foreground">
          <FileText className="mt-0.5 size-4 shrink-0" />
          Briefs you generate show up here so you can revisit them.
        </div>
      ) : (
        <ul className="space-y-2">
          {briefs.map((b) => {
            const active = String(b.id) === selectedId;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onSelect(String(b.id))}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "relative w-full rounded-lg border bg-surface p-3 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/60",
                    active ? "border-primary/40 bg-primary/[0.06]" : "border-border",
                  )}
                >
                  {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
                  <div className="truncate text-[13px] font-medium">{titleOf(b)}</div>
                  <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{b.headline}</p>
                  {b.created_at && (
                    <div className="mt-1.5 font-mono text-[10.5px] text-muted-foreground/70">{formatShortDate(b.created_at)}</div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
