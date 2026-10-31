"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ExternalLink,
  Hash,
  LoaderCircle,
  Mail,
  Pencil,
  SquareCheckBig,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import { Chip, type ChipTone } from "@/components/chip";
import { PersonAvatar } from "@/components/speaker-chip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatShortDate } from "@/lib/format";
import { resolvePerson } from "@/lib/people";
import {
  KIND_LABEL,
  PEOPLE,
  hasEffects,
  payloadDue,
  payloadOwner,
  payloadTarget,
  payloadText,
  type Decision,
  type Effects,
} from "@/lib/review";
import type { Proposal, ProposalKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<ProposalKind, LucideIcon> = {
  notion_task: SquareCheckBig,
  slack_message: Hash,
  email: Mail,
};

const LINK_LABEL: Record<ProposalKind, string> = {
  notion_task: "Open in Notion",
  slack_message: "View in Slack",
  email: "Open email",
};

export interface MeetingRef {
  id: number;
  title: string;
  date: string;
}

interface Props {
  proposal: Proposal;
  /** The number the user sees and speaks (display_no). */
  number: number | null;
  meeting?: MeetingRef;
  fx: Effects;
  /** Approve/reject toggles and inline edit are only available while pending. */
  saving?: boolean;
  onDecision?: (kind: Decision) => void;
  onSave?: (payload: Record<string, unknown>) => Promise<unknown>;
  onFocus?: () => void;
}

const FIELD =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-[13px] outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function ProposalCard({ proposal, number, meeting, fx, saving, onDecision, onSave, onFocus }: Props) {
  const [editing, setEditing] = useState(false);
  const pending = proposal.status === "pending";
  const staged = pending && hasEffects(fx);
  const Icon = KIND_ICON[proposal.kind];
  const sent = proposal.status === "sent";
  const rejected = proposal.status === "rejected";
  const quote = typeof proposal.payload.source_quote === "string" ? proposal.payload.source_quote : null;

  return (
    <motion.article
      layout="position"
      id={`proposal-${proposal.id}`}
      data-proposal-id={proposal.id}
      tabIndex={pending ? 0 : undefined}
      onFocus={onFocus}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: rejected ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      className={cn(
        "group relative flex max-sm:flex-wrap scroll-mb-56 scroll-mt-20 gap-3 rounded-xl border bg-surface p-3.5 outline-none transition-[border-color,box-shadow] sm:gap-4 sm:p-4",
        "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/50",
        staged ? "border-primary/60 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent)]" : "border-border",
        sent && "border-success/30",
      )}
    >
      <NumberBadge number={number} id={proposal.id} sent={sent} rejected={rejected} staged={staged} />

      <div className="min-w-0 flex-1 space-y-2.5 max-sm:min-w-[calc(100%-3.5rem)]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Icon className="size-3.5" strokeWidth={1.75} />
            {KIND_LABEL[proposal.kind]}
          </span>
          {payloadTarget(proposal) && (
            <span className="truncate font-mono text-[11px] text-muted-foreground/80">{payloadTarget(proposal)}</span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <ResultChips proposal={proposal} />
          </span>
        </div>

        <Body proposal={proposal} fx={fx} rejected={rejected} />

        {staged && <EffectChips fx={fx} />}

        {(meeting || quote) && (
          <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
            {meeting && (
              <Link
                href={`/meetings/${meeting.id}`}
                className="inline-flex items-center gap-0.5 font-medium text-foreground/70 hover:text-foreground"
              >
                {meeting.title} <ArrowUpRight className="size-3" />
              </Link>
            )}
            {quote && <span className="min-w-0 italic text-muted-foreground/90">“{quote}”</span>}
          </p>
        )}

        {editing && pending && (
          <EditPanel
            proposal={proposal}
            saving={saving}
            onCancel={() => setEditing(false)}
            onSave={async (payload) => {
              await onSave?.(payload);
              setEditing(false);
            }}
          />
        )}
      </div>

      {pending && !editing && (
        <div className="flex shrink-0 flex-col items-end justify-between gap-2 max-sm:w-full max-sm:flex-row max-sm:items-center max-sm:pl-[3.25rem]">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={fx.decision === "approve" ? "default" : "outline"}
              aria-pressed={fx.decision === "approve"}
              onClick={() => onDecision?.("approve")}
              className={cn("gap-1", fx.decision === "approve" && "bg-success text-black hover:bg-success/85")}
            >
              <Check /> <span className="hidden sm:inline">Approve</span>
              <kbd className="ml-0.5 hidden rounded border border-black/20 px-1 font-mono text-[10px] opacity-60 lg:inline">A</kbd>
            </Button>
            <Button
              size="sm"
              variant={fx.decision === "reject" ? "destructive" : "outline"}
              aria-pressed={fx.decision === "reject"}
              onClick={() => onDecision?.("reject")}
              className="gap-1"
            >
              <X /> <span className="hidden sm:inline">Reject</span>
              <kbd className="ml-0.5 hidden rounded border border-border px-1 font-mono text-[10px] opacity-60 lg:inline">R</kbd>
            </Button>
          </div>
          <Button size="xs" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
        </div>
      )}
    </motion.article>
  );
}

function NumberBadge({
  number, id, sent, rejected, staged,
}: { number: number | null; id: number; sent: boolean; rejected: boolean; staged: boolean }) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg border font-mono text-[15px] font-semibold tabular-nums sm:size-11",
        staged ? "border-primary/50 bg-primary/15 text-[#c4bdff]" : "border-border bg-surface-2 text-foreground/80",
        sent && "border-success/30 bg-success/10 text-success",
        rejected && "text-muted-foreground",
      )}
      aria-label={number ? `Proposal ${number}` : `Proposal id ${id}`}
    >
      {sent ? <Check className="size-4" strokeWidth={2.5} /> : number ? `#${number}` : <span className="text-xs">id {id}</span>}
    </div>
  );
}

function Body({ proposal, fx, rejected }: { proposal: Proposal; fx: Effects; rejected: boolean }) {
  if (proposal.kind === "notion_task") {
    const title = fx.text ?? (typeof proposal.payload.title === "string" ? proposal.payload.title : proposal.summary);
    const owner = fx.owner ?? payloadOwner(proposal);
    const due = fx.due ?? payloadDue(proposal);
    return (
      <div className="space-y-2">
        <h3 className={cn("text-[15px] font-medium leading-snug", rejected && "line-through")}>{title}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {owner ? (
            <span className="inline-flex items-center gap-1.5 pr-1 text-xs text-muted-foreground">
              <PersonAvatar name={owner} />
              {resolvePerson(owner).name}
            </span>
          ) : (
            <Chip tone="rose"><UserX /> No owner</Chip>
          )}
          {due ? (
            <Chip><CalendarDays /> {formatShortDate(due)}</Chip>
          ) : (
            <Chip className="border-dashed"><CalendarDays /> No deadline</Chip>
          )}
        </div>
      </div>
    );
  }
  const text = fx.text ?? payloadText(proposal);
  const subject = typeof proposal.payload.subject === "string" ? proposal.payload.subject : null;
  return (
    <div className="space-y-1">
      {subject && <h3 className="text-[15px] font-medium leading-snug">{subject}</h3>}
      <p className={cn("whitespace-pre-line rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-[13.5px] leading-relaxed text-foreground/90", rejected && "line-through")}>
        {text}
      </p>
    </div>
  );
}

function EffectChips({ fx }: { fx: Effects }) {
  const chips: { key: string; tone: ChipTone; label: string }[] = [];
  if (fx.decision === "approve") chips.push({ key: "a", tone: "emerald", label: "Approve" });
  if (fx.decision === "reject") chips.push({ key: "r", tone: "rose", label: "Reject" });
  if (fx.owner) chips.push({ key: "o", tone: "violet", label: `Reassign → ${resolvePerson(fx.owner).name}` });
  if (fx.due) chips.push({ key: "d", tone: "violet", label: `Due ${formatShortDate(fx.due)}` });
  if (fx.text !== null) chips.push({ key: "t", tone: "violet", label: "Text edited" });
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Staged changes">
      {chips.map((c) => (
        <motion.span key={c.key} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Chip tone={c.tone} className="h-[22px]">{c.label}</Chip>
        </motion.span>
      ))}
    </div>
  );
}

function ResultChips({ proposal }: { proposal: Proposal }) {
  const { status, result, kind } = proposal;
  if (status === "sent") {
    const url = result?.url;
    return (
      <>
        <Chip tone="emerald"><Check /> Sent</Chip>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Chip tone="violet" className="cursor-pointer hover:bg-primary/20"><ExternalLink /> {LINK_LABEL[kind]}</Chip>
          </a>
        ) : result?.external_id ? (
          <Chip className="font-mono">{result.external_id}</Chip>
        ) : null}
      </>
    );
  }
  if (status === "rejected") return <Chip><X /> Rejected</Chip>;
  if (status === "failed") return <Chip tone="rose">Failed{result?.error ? `: ${result.error}` : ""}</Chip>;
  if (status === "approved") return <Chip tone="amber"><LoaderCircle className="animate-spin" /> Sending</Chip>;
  return null;
}

function EditPanel({
  proposal, saving, onCancel, onSave,
}: {
  proposal: Proposal;
  saving?: boolean;
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const isTask = proposal.kind === "notion_task";
  const textKey = isTask ? "title" : proposal.kind === "email" ? "body" : "text";
  const initial = {
    owner: payloadOwner(proposal) ?? "",
    due: payloadDue(proposal) ?? "",
    text: String(proposal.payload[textKey] ?? ""),
  };
  const [owner, setOwner] = useState(initial.owner);
  const [due, setDue] = useState(initial.due);
  const [text, setText] = useState(initial.text);

  const owners: string[] = [...PEOPLE];
  if (initial.owner && !owners.some((o) => resolvePerson(o).name === resolvePerson(initial.owner).name)) owners.push(initial.owner);

  const diff: Record<string, unknown> = {};
  if (text !== initial.text) diff[textKey] = text;
  if (isTask && owner !== initial.owner) diff.owner = owner || null;
  if (isTask && due !== initial.due) Object.assign(diff, { due_date: due || null, deadline: due || null });
  const dirty = Object.keys(diff).length > 0;

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-background/60 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) void onSave(diff);
        else onCancel();
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      {isTask && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Owner
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={cn(FIELD, "text-foreground")}>
              <option value="">Unassigned</option>
              {owners.map((o) => (
                <option key={o} value={o}>{resolvePerson(o).name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Due date
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cn(FIELD, "text-foreground [color-scheme:dark]")} />
          </label>
        </div>
      )}
      <label className="block space-y-1 text-xs text-muted-foreground">
        {isTask ? "Title" : proposal.kind === "email" ? "Email body" : "Message"}
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={isTask ? 2 : 3} className="min-h-0 text-[13px] text-foreground md:text-[13px]" />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={!dirty || saving} className="gap-1.5">
          {saving && <LoaderCircle className="animate-spin" />} Save
        </Button>
      </div>
    </form>
  );
}
