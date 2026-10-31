import { BookMarked } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <EmptyState
      icon={BookMarked}
      title="The ledger is empty"
      description="Decisions from your meetings will be tracked here, with conflicts flagged automatically."
      action="How the ledger works"
    />
  );
}
