"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tone = "rose" | "amber" | "violet" | "neutral";

const TONES: Record<Tone, { icon: string; glow: string; value: string }> = {
  rose: { icon: "bg-conflict/10 text-conflict", glow: "from-conflict/[0.07]", value: "text-conflict" },
  amber: { icon: "bg-warning/10 text-warning", glow: "from-warning/[0.07]", value: "text-warning" },
  violet: { icon: "bg-primary/15 text-[#a89fff]", glow: "from-primary/[0.09]", value: "text-[#a89fff]" },
  neutral: { icon: "bg-surface-2 text-foreground/80", glow: "from-white/[0.03]", value: "text-foreground" },
};

export function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, reduce, mv]);
  return <motion.span>{text}</motion.span>;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  loading,
  href,
}: {
  label: string;
  value: number | undefined;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  loading?: boolean;
  href?: string;
}) {
  const t = TONES[tone];
  const body = (
    <div
      className={cn(
        "relative h-full overflow-hidden rounded-xl border border-border bg-surface p-4 transition-colors",
        href && "hover:border-foreground/15",
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent", t.glow)} />
      <div className="relative flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-7 items-center justify-center rounded-lg", t.icon)}>
          <Icon className="size-3.5" strokeWidth={1.75} />
        </span>
      </div>
      <div className="relative mt-3">
        {loading || value === undefined ? (
          <Skeleton className="h-9 w-14" />
        ) : (
          <div
            className={cn(
              "text-3xl font-semibold leading-9 tracking-tight tabular-nums",
              value > 0 ? t.value : "text-foreground",
            )}
          >
            <CountUp value={value} />
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}
