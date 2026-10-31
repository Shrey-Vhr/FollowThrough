import { Suspense } from "react";
import { MeetingDetailView } from "@/components/meeting/meeting-detail-view";

export default function MeetingPage() {
  return (
    <Suspense>
      <MeetingDetailView />
    </Suspense>
  );
}
