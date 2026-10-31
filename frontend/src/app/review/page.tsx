import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <EmptyState
      icon={ShieldCheck}
      title="Nothing waiting for approval"
      description="Proposals from your meetings will appear here."
      action="How approvals work"
    />
  );
}
