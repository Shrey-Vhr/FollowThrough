import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
      <div className="mb-5 flex size-11 items-center justify-center rounded-xl border border-border bg-surface-2">
        <Icon className="size-5 text-primary" strokeWidth={1.5} />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      <Button variant="ghost" size="sm" className="mt-5 border border-border">
        {action}
      </Button>
    </div>
  );
}
