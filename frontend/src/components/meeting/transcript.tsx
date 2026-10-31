"use client";

import { MessageSquareText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { SpeakerChip } from "@/components/speaker-chip";
import type { Segment } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Scrollable transcript. The active segment gets an accent border and soft glow that fades out. */
export function Transcript({
  segments,
  activeId,
  scrollRef,
  registerSegment,
}: {
  segments: Segment[];
  activeId: number | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  registerSegment: (id: number, el: HTMLElement | null) => void;
}) {
  if (segments.length === 0) {
    return (
      <EmptyState
        compact
        icon={MessageSquareText}
        title="No transcript yet"
        description="The transcript will appear once it finishes processing in Wispr."
        className="m-4"
      />
    );
  }
  return (
    <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto scroll-smooth px-2 py-2 motion-reduce:scroll-auto">
      <ol className="m-0 list-none p-0">
        {segments.map((s) => {
          const active = s.id === activeId;
          return (
            <li
              key={s.id}
              ref={(el) => registerSegment(s.id, el)}
              data-active={active || undefined}
              className={cn(
                "rounded-md border-l-2 px-3 py-2.5 transition-[background-color,border-color,box-shadow] duration-700",
                active
                  ? "border-primary bg-primary/[0.08] shadow-[0_0_28px_-6px_rgba(124,108,255,0.55)] duration-150"
                  : "border-transparent",
              )}
            >
              <SpeakerChip speaker={s.speaker} />
              <p className="mt-1.5 max-w-[68ch] text-[14px] leading-relaxed text-foreground/90">{s.text}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
