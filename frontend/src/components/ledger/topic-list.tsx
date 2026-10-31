"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { plural } from "@/lib/format";
import type { LedgerTopic } from "@/lib/types";
import { cn } from "@/lib/utils";

function ConflictDot({ className }: { className?: string }) {
  return (
    <span
      title="This decision changed over time"
      className={cn("size-2 shrink-0 rounded-full bg-conflict shadow-[0_0_8px_1px_rgba(251,113,133,0.55)]", className)}
    >
      <span className="sr-only">changed over time</span>
    </span>
  );
}

export function LedgerSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search topics and decisions…"
        aria-label="Search topics and decisions"
        className="h-9 border-border bg-surface pl-8 pr-8 text-[13px]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function TopicListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border bg-surface p-3">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

/** Desktop: a vertical list with the current decision under each topic. */
export function TopicList({ topics, selected, onSelect }: { topics: LedgerTopic[]; selected: string; onSelect: (t: string) => void }) {
  return (
    <ul className="hidden space-y-1.5 lg:block" aria-label="Topics">
      {topics.map((t) => {
        const active = t.topic === selected;
        return (
          <li key={t.topic}>
            <button
              type="button"
              onClick={() => onSelect(t.topic)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "relative w-full rounded-lg border px-3 py-2.5 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/60",
                active ? "border-primary/40 bg-primary/[0.07]" : "border-transparent",
              )}
            >
              {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.topic}</span>
                {t.has_conflict && <ConflictDot />}
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.current.statement}</p>
              {t.history.length > 1 && (
                <p className="mt-1 font-mono text-[10.5px] text-muted-foreground/70">{plural(t.history.length, "version")}</p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Mobile/tablet: wrapping chips, so the page never scrolls sideways. */
export function TopicChips({ topics, selected, onSelect }: { topics: LedgerTopic[]; selected: string; onSelect: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 lg:hidden" role="list" aria-label="Topics">
      {topics.map((t) => {
        const active = t.topic === selected;
        return (
          <button
            key={t.topic}
            type="button"
            role="listitem"
            onClick={() => onSelect(t.topic)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
              active
                ? "border-primary/50 bg-primary/15 text-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="truncate">{t.topic}</span>
            {t.has_conflict && <ConflictDot />}
          </button>
        );
      })}
    </div>
  );
}
