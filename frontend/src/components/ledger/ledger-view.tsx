"use client";

import { BookMarked, SearchX, TriangleAlert } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { matchTopic, topicMatches } from "@/lib/ledger";
import { useLedger, useLineage } from "@/lib/queries";
import { Lineage } from "./lineage";
import { LedgerSearch, TopicChips, TopicList, TopicListSkeleton } from "./topic-list";

function LineageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="mt-8 size-3 shrink-0 rounded-full" />
          <Skeleton className="h-24 flex-1 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function LedgerView() {
  const q = useLedger();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const wanted = params.get("topic");
  const [search, setSearch] = useState("");

  const topics = q.data;
  const filtered = useMemo(() => (topics ?? []).filter((t) => topicMatches(t, search)), [topics, search]);

  // The URL's topic wins when it is visible; otherwise the first visible one.
  const selected = useMemo(() => {
    const fromUrl = matchTopic(filtered, wanted);
    return fromUrl ?? filtered[0];
  }, [filtered, wanted]);

  const lineage = useLineage(selected?.current.id);

  const select = (topic: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("topic", topic);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  if (q.isError)
    return (
      <div role="alert" className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 px-6 py-12 text-center">
        <TriangleAlert className="size-5 text-warning" />
        <h2 className="text-sm font-semibold">Couldn&apos;t load the ledger</h2>
        <p className="max-w-sm text-[13px] text-muted-foreground">{q.error.message}</p>
        <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );

  if (!q.isPending && (!topics || topics.length === 0))
    return (
      <EmptyState
        icon={BookMarked}
        title="The ledger is empty"
        description="Decisions from your meetings are tracked here, with changes flagged automatically."
        action="Go to meetings"
        href="/meetings"
      />
    );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
      <div className="space-y-3 lg:sticky lg:top-20">
        <LedgerSearch value={search} onChange={setSearch} />
        {q.isPending ? (
          <TopicListSkeleton />
        ) : filtered.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-[13px] text-muted-foreground">
            <SearchX className="size-4 shrink-0" /> Nothing matches “{search}”.
          </p>
        ) : (
          <>
            <TopicChips topics={filtered} selected={selected?.topic ?? ""} onSelect={select} />
            <TopicList topics={filtered} selected={selected?.topic ?? ""} onSelect={select} />
          </>
        )}
      </div>

      <div className="min-w-0">
        {q.isPending ? (
          <LineageSkeleton />
        ) : selected ? (
          // Keyed by topic so the staggered reveal replays on every selection.
          <Lineage key={selected.topic} topic={selected} lineage={lineage.data} />
        ) : null}
      </div>
    </div>
  );
}
