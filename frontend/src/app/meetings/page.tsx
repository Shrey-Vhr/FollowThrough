import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <EmptyState
      icon={CalendarDays}
      title="No meetings yet"
      description="Import a transcript from Wispr Notetaker and FollowThrough will extract decisions and tasks."
      action="Learn how importing works"
    />
  );
}
