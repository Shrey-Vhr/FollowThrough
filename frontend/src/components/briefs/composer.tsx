"use client";

import { CalendarClock, Mic, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BriefBody } from "@/lib/types";

const EXAMPLES = [
  "Launch date, payments, pricing",
  "API spec status\nOTP login bug\nGST invoices",
  "Beta users, landing page, onboarding",
];

/** The hero: describe the agenda (typed or dictated) and get a brief. */
export function BriefComposer({
  onSubmit,
  disabled,
  error,
}: {
  onSubmit: (body: BriefBody) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const [agenda, setAgenda] = useState("");
  const [at, setAt] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const ready = agenda.trim().length > 0 && !disabled;

  const submit = () => {
    if (!ready) return;
    onSubmit({ agenda: agenda.trim(), meeting_at: at || undefined });
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-primary/[0.12] blur-3xl" />
      <div className="relative px-5 pb-5 pt-7 sm:px-8 sm:pt-9">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-[#a89fff]">
          <Sparkles className="size-3" /> Pre-meeting brief
        </div>
        <h2 className="mt-3 text-2xl font-semibold leading-tight sm:text-[28px]">Prepare for your next meeting</h2>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          Tell us what&apos;s on the agenda. We&apos;ll pull what was decided before, what&apos;s still open and what to ask.
        </p>

        <label htmlFor="agenda" className="sr-only">
          What&apos;s on the agenda?
        </label>
        <Textarea
          id="agenda"
          ref={ref}
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
          rows={4}
          placeholder="What's on the agenda?  e.g. launch date, payments, pricing, GST invoices"
          className="mt-5 min-h-[120px] resize-none rounded-xl border-border bg-background/60 px-4 py-3.5 text-base leading-relaxed shadow-inner placeholder:text-muted-foreground/60 md:text-[15px]"
        />

        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mic className="size-3.5 shrink-0 text-[#a89fff]" />
          Hold your Wispr Flow key and dictate the agenda
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3">
          <label className="flex h-9 min-w-0 max-w-full items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 text-xs text-muted-foreground focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <CalendarClock className="size-3.5 shrink-0" />
            <span className="shrink-0">Meeting time</span>
            <input
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              disabled={disabled}
              aria-label="Meeting time (optional)"
              className="min-w-0 bg-transparent text-xs text-foreground outline-none [color-scheme:dark]"
            />
          </label>
          <span className="hidden text-[11px] text-muted-foreground/70 sm:inline">optional</span>
          <Button size="lg" className="ml-auto h-10 gap-2 px-4 text-sm" disabled={!ready} onClick={submit}>
            <Sparkles /> Generate brief
            <kbd className="ml-1 hidden rounded border border-white/20 px-1 font-mono text-[10px] opacity-70 sm:inline">⌘↵</kbd>
          </Button>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-conflict/25 bg-conflict/10 px-3 py-2 text-[13px] text-conflict">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={disabled}
              onClick={() => {
                setAgenda(ex);
                ref.current?.focus();
              }}
              className="max-w-full truncate rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {ex.replace(/\n/g, " · ")}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
