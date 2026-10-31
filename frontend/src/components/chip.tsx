import { cn } from "@/lib/utils";

export type ChipTone = "rose" | "amber" | "violet" | "emerald" | "sky" | "neutral";

const TONES: Record<ChipTone, string> = {
  rose: "border-conflict/25 bg-conflict/10 text-conflict",
  amber: "border-warning/25 bg-warning/10 text-warning",
  violet: "border-primary/30 bg-primary/10 text-[#a89fff]",
  emerald: "border-success/25 bg-success/10 text-success",
  sky: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  neutral: "border-border bg-surface-2 text-muted-foreground",
};

export function Chip({
  tone = "neutral",
  className,
  children,
  ...props
}: { tone?: ChipTone } & React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium leading-none [&>svg]:size-3 [&>svg]:shrink-0",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
