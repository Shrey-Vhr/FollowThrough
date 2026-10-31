"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATS = [
  { label: "Open conflicts", icon: AlertTriangle, tone: "text-conflict" },
  { label: "Tasks due this week", icon: CalendarClock, tone: "text-warning" },
  { label: "Awaiting approval", icon: ShieldCheck, tone: "text-primary" },
];

function BackendStatus() {
  const { isPending, isSuccess } = useQuery({
    queryKey: ["health"],
    queryFn: () => api<unknown>("/health"),
    retry: false,
    refetchInterval: 15_000,
  });

  if (isPending) return <Skeleton className="h-6 w-24 rounded-full" />;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        isSuccess
          ? "border-success/30 bg-success/10 text-success"
          : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      <span className={cn("size-1.5 rounded-full", isSuccess ? "bg-success" : "bg-warning")} />
      {isSuccess ? "API online" : "API offline"}
    </Badge>
  );
}

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Backend
        </span>
        <BackendStatus />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STATS.map(({ label, icon: Icon, tone }) => (
          <Card key={label} className="gap-3 border border-border bg-surface py-5 shadow-none ring-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[13px] font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={cn("size-4", tone)} strokeWidth={1.75} />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
