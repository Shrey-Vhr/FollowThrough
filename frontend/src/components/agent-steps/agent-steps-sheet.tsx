"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Chip } from "@/components/chip";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { nextNode, proposalCount, RUNNING_LABEL } from "./labels";
import { StepItem } from "./step-item";
import type { AgentRun } from "./use-agent-run";

const MOBILE_QUERY = "(max-width: 767px)";
const subscribeMobile = (cb: () => void) => {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useIsMobile = () =>
  useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false);

export function AgentStepsSheet({
  run,
  meetingTitle,
  open,
  onOpenChange,
}: {
  run: AgentRun;
  meetingTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mobile = useIsMobile();
  const reduce = useReducedMotion();
  const { events, phase, error } = run;
  const upcoming = run.running ? nextNode(events) : null;
  const review = events.find((e) => e.node === "human_review");
  const reviewCount = review ? proposalCount(review) : null;
  // human_review is shown as the violet card, not as a plain timeline row.
  const steps = events.filter((e) => e.node !== "human_review");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className={cn("gap-0 p-0", mobile ? "max-h-[88dvh] rounded-t-2xl" : "sm:max-w-md")}
      >
        <SheetHeader className="gap-1 border-b border-border p-4 pr-12">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-[#a89fff]">
              <Sparkles className="size-3.5" />
            </span>
            <SheetTitle className="text-[15px]">Agent run</SheetTitle>
            {phase === "review" && <Chip tone="violet">Ready for review</Chip>}
            {run.running && <Chip tone="sky">Running</Chip>}
            {phase === "error" && <Chip tone="rose">Interrupted</Chip>}
          </div>
          <SheetDescription className="truncate">{meetingTitle}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5" aria-live="polite">
          <ol className="m-0 list-none p-0">
            {phase === "starting" && (
              <StepItem state="running" message="Starting the agent…" node="process" last />
            )}
            {steps.map((e, i) => (
              <StepItem
                key={`${e.node}-${i}`}
                state={e.status === "error" ? "error" : "done"}
                message={e.message}
                node={e.node}
                last={i === steps.length - 1 && !upcoming && !review}
              />
            ))}
            {upcoming && (
              <StepItem
                key={`pending-${upcoming}`}
                state="running"
                message={RUNNING_LABEL[upcoming] ?? "Working…"}
                node={upcoming}
                last
              />
            )}
          </ol>

          <AnimatePresence>
            {review && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut", delay: reduce ? 0 : 0.1 }}
                className="relative mt-6 overflow-hidden rounded-xl border border-primary/30 bg-primary/[0.07] p-4"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-primary/20 blur-2xl" />
                <div className="relative flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-[#a89fff]">
                    <ShieldCheck className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">
                      {reviewCount !== null
                        ? `${reviewCount} proposal${reviewCount === 1 ? "" : "s"} waiting for your approval`
                        : "Proposals waiting for your approval"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Nothing is sent to Notion or Slack until you approve it.
                    </p>
                  </div>
                </div>
                <Link
                  href="/review"
                  onClick={() => onOpenChange(false)}
                  className={cn(buttonVariants({ size: "default" }), "relative mt-4 w-full justify-center gap-1.5")}
                >
                  Open Review Queue <ArrowRight className="size-3.5" />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === "error" && (
            <div className="mt-6 rounded-xl border border-conflict/25 bg-conflict/[0.06] p-4 text-sm">
              <p className="font-medium text-conflict">The run stopped early</p>
              <p className="mt-1 text-xs text-muted-foreground">{error ?? "Unknown error"}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
