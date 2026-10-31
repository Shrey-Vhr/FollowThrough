"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV, isActive } from "./nav";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-0.5 px-3 pt-2" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-2 h-5 w-[2px] rounded-full bg-primary" />
              )}
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
                strokeWidth={1.75}
              />
              <span className="flex-1 truncate">{label}</span>
              {badge !== undefined && (
                <span className="rounded-md border border-border bg-surface-2 px-1.5 font-mono text-[11px] leading-5 text-muted-foreground">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <span className="text-xs text-muted-foreground">
            Wispr Notetaker <span className="text-border">·</span>{" "}
            <span className="text-foreground">Connected</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-sidebar-border bg-sidebar md:block">
      <SidebarContent />
    </aside>
  );
}
