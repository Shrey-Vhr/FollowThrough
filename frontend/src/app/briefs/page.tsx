import { FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <EmptyState
      icon={FileText}
      title="No briefs yet"
      description="Before your next meeting, FollowThrough will brief you on open decisions and overdue commitments."
      action="See an example brief"
    />
  );
}
