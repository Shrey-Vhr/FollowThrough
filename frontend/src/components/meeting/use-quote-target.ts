"use client";

import { useEffect, useRef } from "react";

/** Called when a card wants its source quote shown in the transcript. `reveal` = also scroll the page there. */
export type QuoteHandler = (reveal: boolean) => void;

/**
 * Props that make a card highlight its source quote on hover (after a short intent delay),
 * keyboard focus, or click.
 */
export function useQuoteTarget(onQuote?: QuoteHandler) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!onQuote) return {};
  return {
    tabIndex: 0,
    onMouseEnter: () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => onQuote(false), 150);
    },
    onMouseLeave: () => clearTimeout(timer.current),
    onFocus: () => onQuote(false),
    onClick: () => {
      clearTimeout(timer.current);
      onQuote(true);
    },
  };
}

export const CARD_BASE =
  "rounded-lg border border-border bg-surface p-3.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60";
export const CARD_INTERACTIVE = "cursor-pointer hover:border-foreground/20";
