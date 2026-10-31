"use client";

import { AnimatePresence, motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateBrief } from "@/lib/mutations";
import { useBrief, useBriefs, useMeetings } from "@/lib/queries";
import type { Brief, BriefBody } from "@/lib/types";
import { BriefDocument } from "./brief-document";
import { BriefComposer } from "./composer";
import { GeneratingBrief } from "./generating";
import { PastBriefs } from "./past-briefs";

function BriefSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 rounded-2xl" />
      {[0, 1].map((i) => (
        <div key={i} className="space-y-4 rounded-xl border border-border bg-surface p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

/** A saved brief. The list response usually carries everything; if not, it is fetched by id. */
function SavedBrief({ summary }: { summary: Brief }) {
  const hasTopics = Array.isArray(summary.topics);
  const q = useBrief(summary.id, hasTopics ? summary : undefined);
  if (q.isPending) return <BriefSkeleton />;
  if (q.isError || !q.data)
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 px-6 py-14 text-center">
        <TriangleAlert className="size-5 text-warning" />
        <p className="text-sm font-medium">Couldn&apos;t load this brief</p>
        <p className="max-w-sm text-[13px] text-muted-foreground">{q.error?.message}</p>
        <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );
  return <BriefDocument brief={q.data} />;
}

export function BriefsView() {
  const briefsQ = useBriefs();
  const meetings = useMeetings();
  const create = useCreateBrief();

  // null = the composer; otherwise a saved brief's id. `fresh` keeps a just-generated brief on screen
  // even before the list refetch includes it.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Brief | null>(null);
  const [pendingAgenda, setPendingAgenda] = useState("");

  const generate = (body: BriefBody) => {
    setPendingAgenda(body.agenda);
    create.mutate(body, {
      onSuccess: (brief) => {
        setFresh(brief);
        setSelectedId(String(brief.id));
      },
    });
  };

  const selected =
    selectedId === null
      ? null
      : (briefsQ.data?.find((b) => String(b.id) === selectedId) ??
        (fresh && String(fresh.id) === selectedId ? fresh : null));

  const reset = () => {
    setSelectedId(null);
    create.reset();
  };

  const generating = create.isPending;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="order-2 lg:order-1 lg:sticky lg:top-20">
        <PastBriefs
          briefs={briefsQ.data}
          loading={briefsQ.isPending}
          error={briefsQ.isError}
          selectedId={selectedId}
          onSelect={(id) => {
            create.reset();
            setSelectedId(id);
          }}
          onNew={reset}
          onRetry={() => void briefsQ.refetch()}
        />
      </div>

      <div className="order-1 min-w-0 lg:order-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={generating ? "gen" : (selected?.id ?? "compose")}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {generating ? (
              <GeneratingBrief agenda={pendingAgenda} meetingCount={meetings.data?.length} />
            ) : selected ? (
              <SavedBrief summary={selected} />
            ) : (
              <BriefComposer
                onSubmit={generate}
                error={create.isError ? `Couldn't generate the brief. ${create.error.message}` : null}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
