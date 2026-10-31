import { Chip, type ChipTone } from "@/components/chip";
import type { TaskStatus } from "@/lib/types";

const MAP: Record<TaskStatus, { label: string; tone: ChipTone }> = {
  open: { label: "Open", tone: "neutral" },
  in_progress: { label: "In progress", tone: "sky" },
  blocked: { label: "Blocked", tone: "rose" },
  completed: { label: "Completed", tone: "emerald" },
};

export function StatusPill({ status }: { status: TaskStatus }) {
  const s = MAP[status] ?? MAP.open;
  return <Chip tone={s.tone}>{s.label}</Chip>;
}
