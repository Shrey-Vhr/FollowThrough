import type { Segment } from "./types";

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}₹\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

/**
 * Fuzzy match: the segment containing the largest share of the quote's words.
 * Returns null if nothing covers at least half of them.
 */
export function findSegmentForQuote(segments: Segment[], quote: string): Segment | null {
  const q = new Set(words(quote));
  if (q.size === 0) return null;
  let best: Segment | null = null;
  let bestScore = 0;
  for (const seg of segments) {
    const have = new Set(words(seg.text));
    let hits = 0;
    for (const w of q) if (have.has(w)) hits++;
    const score = hits / q.size;
    if (score > bestScore) {
      best = seg;
      bestScore = score;
    }
  }
  return bestScore >= 0.5 ? best : null;
}
