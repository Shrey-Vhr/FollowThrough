import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <EmptyState
      icon={ListChecks}
      title="No commitments tracked"
      description="Tasks that people commit to in meetings will be tracked here, with owners and deadlines."
      action="How tracking works"
    />
  );
}
