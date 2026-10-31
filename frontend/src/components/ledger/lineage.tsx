"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Fragment } from "react";
import { ArrowRight, GitCompareArrows, History, Quote, Sparkles } from "lucide-react";
import { Chip } from "@/components/chip";
import { buildLinks, type ChainLink } from "@/lib/ledger";
import { formatShortDate, plural } from "@/lib/format";
import type { LedgerDecision, LedgerLineage, LedgerTopic } from "@/lib/types";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

function Node({
  decision,
  current,
  prev,
  next,
  delay,
  reduce,
}: {
  decision: LedgerDecision;
  current: boolean;
  prev: ChainLink | undefined;
  next: ChainLink | undefined;
  delay: number;
  reduce: boolean | null;
}) {
  const half = (link: ChainLink | undefined) => (link?.conflict ? "bg-conflict/50" : "bg-border");
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 sm:gap-x-4"
    >
      <div className="relative">
        {prev && <span aria-hidden className={cn("absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2", half(prev))} />}
        {next && <span aria-hidden className={cn("absolute bottom-0 left-1/2 h-1/2 w-px -translate-x-1/2", half(next))} />}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {current ? (
            <span className="relative flex size-4 items-center justify-center">
              {!reduce && <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40 [animation-duration:2.4s]" />}
              <span className="relative size-4 rounded-full border-2 border-primary bg-primary shadow-[0_0_0_4px_rgba(124,108,255,0.2)]" />
            </span>
          ) : (
            <span className="block size-3 rounded-full border-2 border-border bg-surface-2" />
          )}
        </span>
      </div>

      <article
        className={cn(
          "relative min-w-0 overflow-hidden rounded-xl border px-4 py-3.5 sm:px-5 sm:py-4",
          current ? "border-primary/40 bg-gradient-to-br from-primary/[0.12] to-surface" : "border-border bg-surface/60",
        )}
      >
        {current && <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("font-mono text-xs", current ? "text-[#a89fff]" : "text-muted-foreground")}>
            {formatShortDate(decision.held_at)}
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">{decision.meeting_title}</span>
          <span className="ml-auto">
            {current ? (
              <Chip tone="violet">
                <Sparkles /> Current
              </Chip>
            ) : (
              <Chip>
                <History /> Superseded
              </Chip>
            )}
          </span>
        </div>
        <p
          className={cn(
            "mt-2 leading-snug",
            current
              ? "text-[17px] font-semibold sm:text-lg"
              : "text-[14px] text-muted-foreground line-through decoration-foreground/25",
          )}
        >
          {decision.statement}
        </p>
        {decision.source_quote && (
          <p className="mt-2.5 flex items-start gap-1.5 text-xs italic leading-relaxed text-muted-foreground">
            <Quote className="mt-0.5 size-3 shrink-0 not-italic opacity-60" />“{decision.source_quote}”
          </p>
        )}
      </article>
    </motion.li>
  );
}

function Connector({ link, delay, reduce }: { link: ChainLink; delay: number; reduce: boolean | null }) {
  const conflict = link.conflict;
  return (
    <li aria-label={conflict ? `Changed ${link.label}` : "Updated"} className="relative grid min-h-[84px] grid-cols-[28px_minmax(0,1fr)] gap-x-3 sm:gap-x-4">
      <div className="relative">
        <motion.span
          aria-hidden
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.45, delay, ease: "easeInOut" }}
          style={{ originY: 0 }}
          className={cn(
            "absolute inset-y-0 left-1/2 w-px -translate-x-1/2",
            conflict ? "bg-gradient-to-b from-conflict/60 via-conflict to-conflict/60" : "bg-border",
          )}
        />
        {conflict && (
          <motion.span
            aria-hidden
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2, duration: 0.3 }}
            className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-conflict shadow-[0_0_10px_2px_rgba(251,113,133,0.5)]"
          />
        )}
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, x: -8, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.4, delay: delay + 0.25, ease: EASE }}
        className="flex min-w-0 flex-col items-start justify-center gap-1.5 py-2"
      >
        {conflict ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-conflict/30 bg-conflict/10 px-3 py-1 text-xs font-medium text-conflict shadow-[0_0_24px_-6px_rgba(251,113,133,0.5)]">
            <GitCompareArrows className="size-3.5 shrink-0" />
            <span className="truncate">
              Changed: {link.label.split(" → ")[0]}
              <ArrowRight className="mx-1 inline size-3 -translate-y-px" />
              {link.label.split(" → ")[1]}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[11px] text-muted-foreground">
            Updated
          </span>
        )}
        {link.explanation && <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">{link.explanation}</p>}
      </motion.div>
    </li>
  );
}

export function Lineage({ topic, lineage }: { topic: LedgerTopic; lineage: LedgerLineage | undefined }) {
  const reduce = useReducedMotion();
  const chain = topic.history;
  const links = buildLinks(chain, lineage, topic.has_conflict);
  const step = Math.min(0.75, 3.6 / Math.max(chain.length, 1));
  const meetings = new Set(chain.map((d) => d.meeting_title)).size;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="min-w-0 text-xl font-semibold leading-tight sm:text-2xl">{topic.topic}</h2>
        {topic.has_conflict && (
          <Chip tone="rose">
            <GitCompareArrows /> Changed over time
          </Chip>
        )}
        <span className="text-xs text-muted-foreground">
          {plural(chain.length, "decision")} across {plural(meetings, "meeting")}
        </span>
      </div>

      <ol aria-label={`Decision lineage for ${topic.topic}`}>
        {chain.map((d, i) => (
          <Fragment key={d.id}>
            <Node
              decision={d}
              current={String(d.id) === String(topic.current.id)}
              prev={links[i - 1]}
              next={links[i]}
              delay={i * step}
              reduce={reduce}
            />
            {links[i] && <Connector link={links[i]} delay={i * step + 0.2} reduce={reduce} />}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
