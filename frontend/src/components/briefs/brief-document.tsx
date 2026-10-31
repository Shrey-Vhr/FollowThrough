"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Clipboard, Hash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { briefToMarkdown, briefToSlack } from "@/lib/brief-markdown";
import { USE_MOCKS } from "@/lib/config";
import { formatDateTime, formatShortDate, plural } from "@/lib/format";
import type { Brief } from "@/lib/types";
import { TopicCard } from "./topic-card";

export function BriefDocument({ brief }: { brief: Brief }) {
  const reduce = useReducedMotion();

  const shareToSlack = () => {
    if (USE_MOCKS) {
      toast.success("Slack message drafted", {
        description: "In the live app it lands in the Review Queue for your approval first.",
      });
      return;
    }
    // No endpoint creates a slack_message proposal from a brief yet, so hand over the Slack-ready text.
    void copyText(briefToSlack(brief), "Slack-formatted brief copied");
  };

  const when = brief.meeting_at ? formatDateTime(brief.meeting_at) : brief.created_at ? `Created ${formatShortDate(brief.created_at)}` : null;

  return (
    <div className="space-y-4">
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-2xl border border-primary/25 bg-surface px-5 py-5 sm:px-6 sm:py-6"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/[0.12] blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium uppercase tracking-wider text-[#a89fff]">
            <span>Your brief</span>
            <span className="text-muted-foreground">·</span>
            <span className="normal-case tracking-normal text-muted-foreground">
              {plural(brief.topics.length, "topic")}
              {when && ` · ${when}`}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-semibold leading-snug sm:text-2xl">{brief.headline}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copyText(briefToMarkdown(brief), "Brief copied as Markdown")}>
              <Clipboard /> Copy brief
            </Button>
            <Button variant="outline" onClick={shareToSlack}>
              <Hash /> Share to Slack
            </Button>
          </div>
        </div>
      </motion.header>

      {brief.topics.map((t, i) => (
        <TopicCard key={`${t.topic}-${i}`} topic={t} index={i} />
      ))}
    </div>
  );
}
