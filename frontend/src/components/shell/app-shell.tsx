import { Suspense } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Suspense>
        <Sidebar />
      </Suspense>
      <div className="flex min-h-screen flex-col md:pl-60">
        <Suspense>
          <TopBar />
        </Suspense>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
