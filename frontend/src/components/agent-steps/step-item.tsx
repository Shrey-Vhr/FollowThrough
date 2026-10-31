"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type StepState = "running" | "done" | "error";

/** One row of the vertical timeline: icon rail, human-readable message, mono node name. */
export function StepItem({
  state,
  message,
  node,
  last,
}: {
  state: StepState;
  message: string;
  node: string;
  last?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="relative flex gap-3 pb-5 last:pb-0"
    >
      {!last && <span aria-hidden className="absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-px bg-border" />}
      <span
        className={cn(
          "relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
          state === "done" && "border-success/30 bg-success/10 text-success",
          state === "running" && "border-primary/40 bg-primary/10 text-primary",
          state === "error" && "border-conflict/30 bg-conflict/10 text-conflict",
        )}
      >
        {state === "done" && <Check className="size-3.5" strokeWidth={2.5} />}
        {state === "running" && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />}
        {state === "error" && <AlertCircle className="size-3.5" />}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className={cn("text-sm leading-snug", state === "running" ? "text-muted-foreground" : "text-foreground")}>
          {message}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">{node}</p>
      </div>
    </motion.li>
  );
}
