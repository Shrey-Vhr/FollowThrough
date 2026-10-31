"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, MotionConfig, useReducedMotion } from "framer-motion";
import { CalendarDays, Inbox, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatShortDate } from "@/lib/format";
import { useConfirmProposals, usePatchProposal, useVoiceCommand } from "@/lib/mutations";
import { useMeetings, useProposals } from "@/lib/queries";
import {
  affectedIds,
  changeRows,
  describePreview,
  effectsOf,
  numberOf,
  toggleDecision,
  type Decision,
} from "@/lib/review";
import type { Proposal, ReviewAction } from "@/lib/types";
import { PreviewDialog } from "./preview-dialog";
import { ProposalCard, type MeetingRef } from "./proposal-card";
import { VoiceBar } from "./voice-bar";

type Tab = "pending" | "sent" | "rejected";
interface Settled {
  proposal: Proposal;
  number: number | null;
}

const SETTLE_MS = 2200;
const EMPTY: Proposal[] = [];

export function ReviewView() {
  const reduce = useReducedMotion();
  const pendingQ = useProposals("pending");
  const sentQ = useProposals("sent");
  const rejectedQ = useProposals("rejected");
  const meetingsQ = useMeetings();
  const patch = usePatchProposal();
  const voiceMut = useVoiceCommand();
  const confirmMut = useConfirmProposals();

  const [tab, setTab] = useState<Tab>("pending");
  const [staged, setStaged] = useState<ReviewAction[]>([]);
  const [voice, setVoice] = useState<{ preview: string; warnings: string[] } | null>(null);
  const [command, setCommand] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settled, setSettled] = useState<Record<number, Settled>>({});
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const meetings = useMemo(() => {
    const map = new Map<number, MeetingRef>();
    for (const m of meetingsQ.data ?? []) map.set(m.id, { id: m.id, title: m.title, date: formatShortDate(m.held_at) });
    return map;
  }, [meetingsQ.data]);

  // Pending cards stay on screen, in their new "Sent" / "Rejected" state, for a moment after confirming.
  const pendingItems = pendingQ.data ?? EMPTY;
  const shown = useMemo(() => {
    const byId = new Map<number, Settled>(pendingItems.map((p) => [p.id, { proposal: p, number: numberOf(p) }]));
    for (const [id, s] of Object.entries(settled)) byId.set(Number(id), s);
    return [...byId.values()].sort((a, b) => a.proposal.id - b.proposal.id);
  }, [pendingItems, settled]);
  const stillPending = useMemo(() => pendingItems.filter((p) => !(p.id in settled)), [pendingItems, settled]);

  const groups = useMemo(() => {
    const out: { key: number | null; items: Settled[] }[] = [];
    for (const s of shown) {
      const key = s.proposal.meeting_id ?? null;
      const group = out.find((g) => g.key === key);
      if (group) group.items.push(s);
      else out.push({ key, items: [s] });
    }
    return out;
  }, [shown]);

  // ---- staging ---------------------------------------------------------------

  const onDecision = useCallback((id: number, kind: Decision) => {
    setStaged((cur) => toggleDecision(cur, id, kind));
    setVoice(null); // the preview sentence is rebuilt locally once the user edits by hand
  }, []);

  const stagedCount = affectedIds(staged).filter((id) => stillPending.some((p) => p.id === id)).length;
  const previewText = voice ? voice.preview : describePreview(stillPending, staged);
  const rows = useMemo(() => changeRows(stillPending, staged), [stillPending, staged]);

  const clearStaged = () => {
    setStaged([]);
    setVoice(null);
  };

  const submitCommand = async () => {
    const res = await voiceMut.mutateAsync(command.trim()).catch(() => null);
    if (!res) return;
    setStaged(res.actions);
    setVoice({ preview: res.preview, warnings: res.warnings });
    setDialogOpen(true);
  };

  const confirm = async () => {
    const numbers = new Map(stillPending.map((p) => [p.id, numberOf(p)]));
    const res = await confirmMut.mutateAsync(staged).catch(() => null);
    if (!res) return;
    const done = res.proposals.filter((p) => p.status !== "pending");
    setSettled((cur) => ({
      ...cur,
      ...Object.fromEntries(done.map((p) => [p.id, { proposal: p, number: numbers.get(p.id) ?? null }])),
    }));
    const sent = done.filter((p) => p.status === "sent").length;
    const rejected = done.filter((p) => p.status === "rejected").length;
    const failed = done.filter((p) => p.status === "failed").length;
    const parts = [sent && `${sent} sent`, rejected && `${rejected} rejected`, failed && `${failed} failed`].filter(Boolean);
    if (failed) toast.error(parts.join(" · "));
    else toast.success(parts.join(" · ") || "Changes saved");
    clearStaged();
    setCommand("");
    setDialogOpen(false);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setSettled({}), reduce ? 600 : SETTLE_MS);
  };

  const onDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) requestAnimationFrame(() => textareaRef.current?.focus()); // "Edit": back to the command
  };

  // ---- keyboard: 1-9 focus a card, A approves, R rejects the focused one ------------

  const interactive = useRef(stillPending);
  useEffect(() => {
    interactive.current = stillPending;
  }, [stillPending]);
  const dialogOpenRef = useRef(dialogOpen);
  useEffect(() => {
    dialogOpenRef.current = dialogOpen;
  }, [dialogOpen]);

  useEffect(() => {
    if (tab !== "pending") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing || dialogOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      const key = e.key.toLowerCase();
      if (/^[1-9]$/.test(key)) {
        const p = interactive.current.find((x) => numberOf(x) === Number(key));
        const el = p && document.getElementById(`proposal-${p.id}`);
        if (el) {
          e.preventDefault();
          el.focus();
        }
      } else if (key === "a" || key === "r") {
        const card = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-proposal-id]");
        const id = Number(card?.dataset.proposalId);
        if (card && interactive.current.some((x) => x.id === id)) {
          e.preventDefault();
          onDecision(id, key === "a" ? "approve" : "reject");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, onDecision]);

  // ---- render -----------------------------------------------------------------------

  const counts = {
    pending: pendingQ.isPending ? undefined : stillPending.length,
    sent: sentQ.data?.length,
    rejected: rejectedQ.data?.length,
  };
  const noPending = !pendingQ.isPending && shown.length === 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6 pb-56 sm:pb-52">
        <header className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Review Queue</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Nothing leaves FollowThrough until you approve it.</p>
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList variant="line" className="h-9 w-full justify-start border-b border-border pb-px">
              {(["pending", "sent", "rejected"] as const).map((t) => (
                <TabsTrigger key={t} value={t} className="flex-none gap-2 px-3 capitalize">
                  {t}
                  {counts[t] !== undefined && (
                    <span className="rounded-md border border-border bg-surface-2 px-1.5 font-mono text-[11px] leading-5 text-muted-foreground">
                      {counts[t]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </header>

        {tab === "pending" ? (
          pendingQ.isPending ? (
            <ListSkeleton />
          ) : pendingQ.isError ? (
            <EmptyState
              icon={ShieldCheck}
              title="Couldn't load the review queue"
              description="The API didn't respond. Check that the backend is running."
              action="Retry"
              onAction={() => void pendingQ.refetch()}
            />
          ) : noPending ? (
            <EmptyState
              icon={ShieldCheck}
              title="Nothing waiting for approval"
              description="Proposals from your meetings will appear here."
              action="Go to Meetings"
              href="/meetings"
            />
          ) : (
            <LayoutGroup>
              <div className="space-y-8">
                {groups.map((g) => {
                  const meeting = g.key !== null ? meetings.get(g.key) : undefined;
                  return (
                    <section key={g.key ?? "none"} className="space-y-3" aria-label={meeting?.title ?? "Proposals"}>
                      {meeting && (
                        <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <CalendarDays className="size-3.5" />
                          <Link href={`/meetings/${meeting.id}`} className="text-foreground/80 hover:text-foreground">
                            {meeting.title}
                          </Link>
                          <span>·</span>
                          <span>{meeting.date}</span>
                          <span className="h-px flex-1 bg-border" />
                        </h3>
                      )}
                      <div className="space-y-3">
                        <AnimatePresence initial={false}>
                          {g.items.map(({ proposal, number }) => (
                            <ProposalCard
                              key={proposal.id}
                              proposal={proposal}
                              number={number}
                              meeting={meeting}
                              fx={effectsOf(staged, proposal.id)}
                              saving={patch.isPending && patch.variables?.id === proposal.id}
                              onDecision={(k) => onDecision(proposal.id, k)}
                              onSave={(payload) => patch.mutateAsync({ id: proposal.id, payload })}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </section>
                  );
                })}
              </div>
            </LayoutGroup>
          )
        ) : (
          <ReadOnlyList
            proposals={tab === "sent" ? sentQ.data : rejectedQ.data}
            loading={tab === "sent" ? sentQ.isPending : rejectedQ.isPending}
            tab={tab}
            meetings={meetings}
          />
        )}
      </div>

      <VoiceBar
        value={command}
        onChange={setCommand}
        onSubmit={() => void submitCommand()}
        loading={voiceMut.isPending}
        disabled={noPending && !pendingQ.isPending}
        textareaRef={textareaRef}
      >
        {stagedCount > 0 && tab === "pending" && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 py-1.5 pl-3.5 pr-1.5 text-[13px]">
            <span className="text-[#c4bdff]">
              {stagedCount} staged · not sent yet
            </span>
            <span className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={clearStaged} className="gap-1 text-muted-foreground">
                <X /> Clear
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
                <Send /> Review &amp; send ({stagedCount})
              </Button>
            </span>
          </div>
        )}
      </VoiceBar>

      <PreviewDialog
        open={dialogOpen}
        onOpenChange={onDialogChange}
        preview={previewText}
        warnings={voice?.warnings ?? []}
        rows={rows}
        confirming={confirmMut.isPending}
        onConfirm={() => void confirm()}
      />
    </MotionConfig>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4 rounded-xl border border-border bg-surface p-4">
          <Skeleton className="size-11 rounded-lg" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReadOnlyList({
  proposals,
  loading,
  tab,
  meetings,
}: {
  proposals: Proposal[] | undefined;
  loading: boolean;
  tab: "sent" | "rejected";
  meetings: Map<number, MeetingRef>;
}) {
  if (loading) return <ListSkeleton />;
  if (!proposals?.length) {
    return (
      <EmptyState
        icon={Inbox}
        title={tab === "sent" ? "Nothing sent yet" : "Nothing rejected"}
        description={
          tab === "sent"
            ? "Approved proposals show up here once they've been sent."
            : "Proposals you reject are kept here for reference."
        }
        compact
      />
    );
  }
  return (
    <div className="space-y-3">
      {proposals.map((p) => (
        <ProposalCard
          key={p.id}
          proposal={p}
          number={null}
          meeting={p.meeting_id != null ? meetings.get(p.meeting_id) : undefined}
          fx={{ decision: null, owner: null, due: null, text: null }}
        />
      ))}
    </div>
  );
}
