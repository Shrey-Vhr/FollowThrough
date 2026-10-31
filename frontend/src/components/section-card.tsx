import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  count,
  action,
  children,
  className,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface", className)}>
      <header className="flex h-12 items-center gap-2 border-b border-border px-4">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {count !== undefined && (
          <span className="rounded-md border border-border bg-surface-2 px-1.5 font-mono text-[11px] leading-5 text-muted-foreground">
            {count}
          </span>
        )}
        <div className="ml-auto">{action}</div>
      </header>
      {children}
    </section>
  );
}
