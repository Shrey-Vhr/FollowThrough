"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** The brief endpoint reports no progress, so the first steps advance on a timer and the last waits for the response. */
const DELAYS = [1100, 2300];

export function GeneratingBrief({ agenda, meetingCount }: { agenda: string; meetingCount?: number }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timers = DELAYS.map((d, i) => setTimeout(() => setActive(i + 1), d));
    return () => timers.forEach(clearTimeout);
  }, []);

  const steps = [
    "Splitting agenda into topics",
    meetingCount ? `Searching ${meetingCount} meetings` : "Searching your meetings",
    "Writing your brief",
  ];

  return (
    <section
      aria-live="polite"
      className="relative overflow-hidden rounded-2xl border border-border bg-surface px-5 py-10 sm:px-8"
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[32rem] max-w-full -translate-x-1/2 rounded-full bg-primary/[0.14] blur-3xl" />
      <div className="relative mx-auto max-w-md">
        <h2 className="text-center text-lg font-semibold">Preparing your brief</h2>
        <p className="mx-auto mt-1 line-clamp-2 max-w-sm break-words text-center text-[13px] text-muted-foreground">{agenda}</p>

        <ol className="mt-8 space-y-1">
          {steps.map((label, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <motion.li
                key={label}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: i <= active ? 1 : 0.4, y: 0 }}
                transition={{ duration: 0.3 }}
                className="relative flex items-center gap-3 rounded-lg px-3 py-2.5"
              >
                {current && (
                  <motion.span
                    layoutId={reduce ? undefined : "gen-active"}
                    className="absolute inset-0 rounded-lg border border-primary/25 bg-primary/[0.07]"
                  />
                )}
                <span
                  className={cn(
                    "relative flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]",
                    done && "border-success/30 bg-success/10 text-success",
                    current && "border-primary/40 bg-primary/15 text-[#a89fff]",
                    !done && !current && "border-border text-muted-foreground",
                  )}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {done ? (
                      <motion.span key="d" initial={reduce ? false : { scale: 0.4 }} animate={{ scale: 1 }}>
                        <Check className="size-3.5" />
                      </motion.span>
                    ) : current ? (
                      <Loader2 key="l" className="size-3.5 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <span key="n">{i + 1}</span>
                    )}
                  </AnimatePresence>
                </span>
                <span className={cn("relative text-sm", current ? "font-medium" : "text-muted-foreground")}>
                  {label}
                  {current && <span className="text-muted-foreground">…</span>}
                </span>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
