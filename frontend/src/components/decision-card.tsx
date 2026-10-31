import { Quote } from "lucide-react";
import { Chip } from "@/components/chip";
import { CARD_BASE, CARD_INTERACTIVE, useQuoteTarget, type QuoteHandler } from "@/components/meeting/use-quote-target";
import { SpeakerChip } from "@/components/speaker-chip";
import type { Decision } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DecisionCard({ decision, onQuote }: { decision: Decision; onQuote?: QuoteHandler }) {
  const target = useQuoteTarget(onQuote);
  const superseded = decision.status === "superseded";
  return (
    <article className={cn(CARD_BASE, onQuote && CARD_INTERACTIVE)} {...target}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {decision.topic}
        </span>
        {superseded && <Chip tone="neutral">Superseded</Chip>}
        {decision.made_by && <SpeakerChip speaker={decision.made_by} className="ml-auto" />}
      </div>
      <p className={cn("mt-2 text-sm font-medium leading-snug", superseded && "text-foreground/60")}>
        {decision.statement}
      </p>
      <blockquote className="mt-3 flex gap-2 border-l-2 border-border pl-3 text-[13px] italic leading-relaxed text-muted-foreground">
        <Quote className="mt-0.5 size-3 shrink-0 text-primary/70" />
        <span>{decision.source_quote}</span>
      </blockquote>
    </article>
  );
}
