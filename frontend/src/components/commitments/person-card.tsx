"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import { PersonAvatar } from "@/components/speaker-chip";
import { resolvePerson } from "@/lib/people";
import type { Commitment } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIZE = 92;

/** Radial progress. Violet throughout (emerald once everything is done): a gentle read, never an alarm. */
function Radial({ rate, complete }: { rate: number; complete: boolean }) {
  const pct = Math.round(rate * 100);
  const fill = complete ? "#34d399" : "#7c6cff";
  return (
    <div
      className="relative shrink-0"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={`${pct}% of commitments completed`}
    >
      <RadialBarChart
        width={SIZE}
        height={SIZE}
        data={[{ value: pct }]}
        innerRadius={34}
        outerRadius={44}
        barSize={9}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar
          dataKey="value"
          cornerRadius={6}
          fill={fill}
          background={{ fill: "#1c1c22" }}
          isAnimationActive
          animationDuration={900}
        />
      </RadialBarChart>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold leading-none tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "amber" }) {
  return (
    <div className="min-w-0">
      <div className={cn("text-base font-semibold tabular-nums leading-none", tone === "amber" && "text-warning")}>{value}</div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function PersonCard({ person, index, active, onSelect }: { person: Commitment; index: number; active: boolean; onSelect: () => void }) {
  const reduce = useReducedMotion();
  const p = resolvePerson(person.name);
  const complete = person.committed > 0 && person.completed === person.committed;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: reduce ? 0 : index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative min-w-0 overflow-hidden rounded-xl border bg-surface p-4 text-left outline-none transition-colors hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring/60",
        active ? "border-primary/40" : "border-border",
      )}
    >
      {active && <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />}
      <div className="flex items-center gap-3">
        <PersonAvatar name={person.name} size="lg" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{p.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {person.committed === 0 ? "No commitments yet" : `${person.completed} of ${person.committed} done`}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Radial rate={person.follow_through_rate} complete={complete} />
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-3.5">
          <Stat label="Committed" value={person.committed} />
          <Stat label="Completed" value={person.completed} />
          <Stat label="Overdue" value={person.overdue} />
          <Stat
            label="Pushed back"
            value={person.total_rollovers > 0 ? `${person.total_rollovers}×` : "0"}
            tone={person.total_rollovers > 0 ? "amber" : undefined}
          />
        </div>
      </div>
    </motion.button>
  );
}
