"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { navFor } from "./nav";
import { useImportDialog } from "@/components/wispr/import-dialog";
import { SidebarContent } from "./sidebar";

export function TopBar() {
  const pathname = usePathname();
  const { title, subtitle } = navFor(pathname);
  const [open, setOpen] = useState(false);
  const importDialog = useImportDialog();
  // The dashboard and meetings pages carry their own import button.
  const showImport = pathname !== "/" && pathname !== "/meetings";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-4" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-60 gap-0 border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold leading-tight">{title}</h1>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
      </div>

      <div className="relative hidden w-64 lg:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search decisions, tasks…"
          aria-label="Search"
          className="h-8 border-border bg-surface pl-8 pr-12 text-[13px]"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-surface-2 px-1.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      {showImport && (
      <Button size="sm" className="gap-1.5" onClick={importDialog.open}>
        <Download className="size-3.5" />
        <span className="hidden sm:inline">Import from Wispr</span>
        <span className="sm:hidden">Import</span>
      </Button>
      )}
    </header>
  );
}
