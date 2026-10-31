import { FileText, Mic } from "lucide-react";
import { Chip } from "@/components/chip";
import type { MeetingSource } from "@/lib/types";

export function SourceBadge({ source }: { source: MeetingSource }) {
  if (source === "wispr") {
    return (
      <Chip tone="violet">
        <Mic /> Wispr Notetaker
      </Chip>
    );
  }
  return (
    <Chip>
      <FileText /> {source === "upload" ? "Uploaded" : "Manual"}
    </Chip>
  );
}
