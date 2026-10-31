import { formatShortDate } from "@/lib/format";
import type { Brief, BriefTopic } from "@/lib/types";

function dueText(deadline: string | null): string {
  if (!deadline) return "no date";
  return /^\d{4}-\d{2}-\d{2}/.test(deadline) ? `due ${formatShortDate(deadline)}` : deadline;
}

export function topicToMarkdown(t: BriefTopic): string {
  const out: string[] = [`## ${t.topic}`, ""];
  out.push(t.current_decision ? `**Current decision:** ${t.current_decision}` : "**Current decision:** nothing decided yet");
  if (t.history.length > 1) {
    out.push("", "**History**");
    for (const h of t.history) out.push(`- ${formatShortDate(h.date)} (${h.meeting_title}): ${h.statement}`);
  }
  if (t.open_conflicts.length) out.push("", "**Open conflicts**", ...t.open_conflicts.map((c) => `- ${c}`));
  if (t.open_tasks.length) {
    out.push("", "**Open tasks**");
    for (const k of t.open_tasks) {
      const pushed = k.rollover_count > 0 ? `, pushed back ${k.rollover_count}×` : "";
      out.push(`- ${k.title} (${k.owner ?? "no owner"}, ${dueText(k.deadline)}${pushed})`);
    }
  }
  if (t.unresolved.length) out.push("", "**Unresolved**", ...t.unresolved.map((u) => `- ${u}`));
  if (t.suggested_questions.length) out.push("", "**Ask in this meeting**", ...t.suggested_questions.map((q) => `- ${q}`));
  return out.join("\n");
}

export function briefToMarkdown(b: Brief): string {
  return [`# Meeting brief`, "", `> ${b.headline}`, "", ...b.topics.map(topicToMarkdown).flatMap((s) => [s, ""])].join("\n").trimEnd() + "\n";
}

/** A shorter, Slack-flavoured version (single asterisks for bold). */
export function briefToSlack(b: Brief): string {
  const lines = [`*Meeting brief*`, b.headline, ""];
  for (const t of b.topics) {
    lines.push(`*${t.topic}*: ${t.current_decision ?? "nothing decided yet"}`);
    for (const q of t.suggested_questions.slice(0, 1)) lines.push(`  • ${q}`);
  }
  return lines.join("\n");
}
