import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  href,
  onAction,
  compact = false,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: string;
  href?: string;
  onAction?: () => void;
  /** Smaller variant for use inside a card. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 px-6 text-center",
        compact ? "min-h-[180px] py-8" : "min-h-[420px] py-16",
        className,
      )}
    >
      <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-border bg-surface-2">
        <Icon className="size-[18px] text-primary" strokeWidth={1.5} />
      </div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>
      {action &&
        (href ? (
          <Link
            href={href}
            className="mt-4 inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted"
          >
            {action}
          </Link>
        ) : (
          <Button variant="ghost" size="sm" className="mt-4 border border-border" onClick={onAction}>
            {action}
          </Button>
        ))}
    </div>
  );
}
