"use client";

import { ListChecks, Mail, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PersonAvatar } from "@/components/speaker-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { plural } from "@/lib/format";
import { useRunDigest } from "@/lib/mutations";
import { useCommitments } from "@/lib/queries";
import { resolvePerson } from "@/lib/people";
import { PersonCard } from "./person-card";
import { TaskRow } from "./task-row";

function Loading() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <Skeleton className="size-[92px] rounded-full" />
              <div className="grid flex-1 grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-8" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-surface">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-0">
            <Skeleton className="size-4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommitmentsView() {
  const q = useCommitments();
  const digest = useRunDigest();
  const router = useRouter();
  const [focus, setFocus] = useState<string | null>(null);

  const people = q.data;
  const shown = useMemo(
    () => (people ?? []).filter((p) => focus === null || String(p.person_id) === focus),
    [people, focus],
  );

  const sendDigest = () =>
    digest.mutate(undefined, {
      onSuccess: (r) => {
        if (r.proposals_created === 0) {
          toast.info("Nothing to send this week", { description: "Everyone is all caught up." });
          return;
        }
        toast.success(`${plural(r.proposals_created, "digest email")} added to the Review Queue`, {
          description: "Nothing is sent until you approve it.",
          action: { label: "Open Review Queue", onClick: () => router.push("/review") },
        });
      },
      onError: (e) => toast.error("Couldn't prepare the digests", { description: e.message }),
    });

  if (q.isPending) return <Loading />;

  if (q.isError)
    return (
      <div role="alert" className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 px-6 py-12 text-center">
        <TriangleAlert className="size-5 text-warning" />
        <h2 className="text-sm font-semibold">Couldn&apos;t load commitments</h2>
        <p className="max-w-sm text-[13px] text-muted-foreground">{q.error.message}</p>
        <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );

  if (!people || people.length === 0 || people.every((p) => p.committed === 0))
    return (
      <EmptyState
        icon={ListChecks}
        title="No commitments tracked yet"
        description="When people commit to something in a meeting, it shows up here with its owner, deadline and history."
        action="Go to meetings"
        href="/meetings"
      />
    );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-tight sm:text-2xl">Who&apos;s following through</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A look at what the team promised and what has moved. Use it to unblock people, not to keep score.
          </p>
        </div>
        <Button size="lg" className="gap-1.5" disabled={digest.isPending} onClick={sendDigest}>
          <Mail /> {digest.isPending ? "Preparing digests…" : "Send weekly digest"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {people.map((p, i) => (
          <PersonCard
            key={p.person_id}
            person={p}
            index={i}
            active={focus === String(p.person_id)}
            onSelect={() => setFocus((f) => (f === String(p.person_id) ? null : String(p.person_id)))}
          />
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-semibold">
            Tasks
            {focus !== null && shown[0] && (
              <span className="ml-2 font-normal text-muted-foreground">for {resolvePerson(shown[0].name).name}</span>
            )}
          </h3>
          {focus !== null && (
            <button type="button" onClick={() => setFocus(null)} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Show everyone
            </button>
          )}
        </div>

        {shown.map((p) => (
          <section key={p.person_id} aria-label={`${p.name}'s tasks`} className="overflow-hidden rounded-xl border border-border bg-surface">
            <header className="flex h-12 items-center gap-2.5 border-b border-border px-4">
              <PersonAvatar name={p.name} />
              <h4 className="text-[13px] font-semibold">{resolvePerson(p.name).name}</h4>
              <span className="rounded-md border border-border bg-surface-2 px-1.5 font-mono text-[11px] leading-5 text-muted-foreground">
                {p.tasks.length}
              </span>
            </header>
            {p.tasks.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No tasks yet.</p>
            ) : (
              <ul>
                {p.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
