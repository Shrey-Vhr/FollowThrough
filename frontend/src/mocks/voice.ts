import { MOCK_TODAY } from "@/lib/config";
import { describePreview, payloadText, payloadTitle, PEOPLE } from "@/lib/review";
import type { Proposal, ReviewAction, VoiceCommandResult } from "@/lib/types";

/**
 * A small keyword parser standing in for the backend's LLM voice parser. It understands the demo
 * commands: "approve all/everything (except …)", "reject <n>", "give/assign <x> to <name>",
 * "due <date>", number words ("won and two") and pronouns ("approve it").
 */

const NUMBER_WORDS: Record<string, number> = {
  won: 1, one: 1, first: 1, two: 2, to: 2, too: 2, second: 2, three: 3, tree: 3, third: 3,
  four: 4, for: 4, fourth: 4, five: 5, fifth: 5, six: 6, sixth: 6, seven: 7, eight: 8, ate: 8, nine: 9,
};
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const STOP = new Set(
  "the a an of for on in it its that this one ones thing please and also then but to with by task tasks message messages slack bug approve reject give assign reassign set due deadline date make is are".split(" "),
);

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "November 10th", "nov 10", "tomorrow", "next Friday", "2026-11-10" -> ISO date, or null. */
export function parseSpokenDate(raw: string, today: Date = MOCK_TODAY): string | null {
  const s = raw.toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1").trim();
  const isoMatch = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s);
  if (isoMatch) return isoMatch[0];
  const monthFirst = /\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})\b/.exec(s);
  const dayFirst = /\b(\d{1,2})\s+(?:of\s+)?([a-z]{3})[a-z]*\b/.exec(s);
  const [mon, day] = monthFirst ? [monthFirst[1], monthFirst[2]] : dayFirst ? [dayFirst[2], dayFirst[1]] : [];
  if (mon && MONTHS.includes(mon)) {
    let d = new Date(today.getFullYear(), MONTHS.indexOf(mon), Number(day));
    if (d < today) d = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
    return iso(d);
  }
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (/\btomorrow\b/.test(s)) return iso(new Date(base.getTime() + 86_400_000));
  if (/\btoday\b/.test(s)) return iso(base);
  const wd = WEEKDAYS.findIndex((w) => s.includes(w));
  if (wd >= 0) {
    const ahead = ((wd - base.getDay() + 7) % 7) || 7;
    return iso(new Date(base.getFullYear(), base.getMonth(), base.getDate() + ahead));
  }
  return null;
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9₹ ]/g, " ").split(/\s+/).filter(Boolean);

/** Display numbers mentioned in a clause: "#2", "2", "won and two". */
function numbersIn(clause: string): number[] {
  const out: number[] = [];
  for (const m of clause.matchAll(/#?\b(\d)\b/g)) out.push(Number(m[1]));
  const toks = words(clause);
  toks.forEach((w, i) => {
    if (!(w in NUMBER_WORDS)) return;
    // "to"/"too"/"for"/"ate" are only numbers right after a verb or a number list.
    const ambiguous = ["to", "too", "for", "ate", "tree"].includes(w);
    const prev = toks[i - 1];
    const listy = !prev || ["approve", "reject", "and", "number", "proposal", "proposals", "send", "skip"].includes(prev);
    if (!ambiguous || listy) out.push(NUMBER_WORDS[w]);
  });
  return out;
}

export function parseVoiceCommand(text: string, pending: Proposal[]): VoiceCommandResult {
  const byNumber = new Map(pending.map((p) => [p.display_no ?? p.id, p]));
  const warnings: string[] = [];
  const actions: ReviewAction[] = [];
  const add = (action: ReviewAction["action"], ids: number[], extra: Partial<ReviewAction> = {}) => {
    const unique = [...new Set(ids)].sort((a, b) => a - b);
    if (!unique.length) return;
    const existing = actions.find(
      (a) => a.action === action && (a.to ?? null) === (extra.to ?? null) && (a.date ?? null) === (extra.date ?? null),
    );
    if (existing) existing.proposal_ids = [...new Set([...existing.proposal_ids, ...unique])].sort((a, b) => a - b);
    else actions.push({ action, proposal_ids: unique, to: null, date: null, text: null, ...extra });
  };

  const clauses = text
    .split(/[,;.]|\s+(?:but|then)\s+|\s+and\s+(?=(?:approve|reject|give|assign|set|send|skip)\b)/i)
    .map((c) => c.trim())
    .filter(Boolean);

  let last: Proposal[] = [];
  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    const verb =
      /\b(approve|accept|send|confirm|okay|ok)\b/.test(lower) ? "approve"
      : /\b(reject|decline|skip|drop|discard)\b/.test(lower) ? "reject"
      : /\b(give|assign|reassign|hand|move)\b/.test(lower) ? "reassign"
      : /\b(due|deadline|by)\b/.test(lower) ? "deadline"
      : null;
    if (!verb) {
      warnings.push(`I didn't understand "${clause}".`);
      continue;
    }

    const [positive, exclusion = ""] = lower.split(/\b(?:except|apart from|other than)\b/);

    // Which proposals does this clause talk about?
    let targets: Proposal[] = [];
    const kindFilter = /\btasks?\b/.test(positive) ? "notion_task" : /\b(slack|messages?)\b/.test(positive) ? "slack_message" : null;
    if (/\b(all|everything|every|rest)\b/.test(positive)) {
      targets = pending.filter((p) => !kindFilter || p.kind === kindFilter);
    } else {
      const nums = numbersIn(positive);
      for (const n of nums) {
        const p = byNumber.get(n);
        if (p) targets.push(p);
        else warnings.push(`There is no proposal #${n}.`);
      }
      if (!nums.length) targets = matchByContent(positive, pending, verb === "reassign" || verb === "deadline");
      // "it", or a bare "due November 10th" clause, continues the previous clause
      if (!nums.length && !targets.length && (verb === "deadline" || /\b(it|that|them|those)\b/.test(positive))) targets = last;
    }
    if (exclusion) {
      const excluded = new Set([...numbersIn(exclusion).map((n) => byNumber.get(n)?.id), ...matchByContent(exclusion, pending, false).map((p) => p.id)]);
      targets = targets.filter((p) => !excluded.has(p.id));
    }
    if (!targets.length) {
      if (!warnings.some((w) => w.startsWith("There is no"))) warnings.push(`I couldn't tell which proposal "${clause}" refers to.`);
      continue;
    }
    last = targets;
    const ids = targets.map((p) => p.id);

    if (verb === "approve" || verb === "reject") {
      add(verb, ids);
      continue;
    }

    // reassign / set deadline: only tasks have an owner and a date.
    const tasks = targets.filter((p) => p.kind === "notion_task");
    if (tasks.length < targets.length) warnings.push("Owners and due dates only apply to Notion tasks.");
    const toMatch = /\bto\s+([a-z][a-z .'-]*?)(?=\s+(?:due|by|on|before)\b|$)/.exec(lower);
    if (verb === "reassign" && toMatch) {
      const name = toMatch[1].trim();
      const person = PEOPLE.find((n) => n.toLowerCase() === name || n.toLowerCase().startsWith(name.split(" ")[0]));
      if (person) add("reassign", tasks.map((p) => p.id), { to: person });
      else warnings.push(`I don't know who '${name[0].toUpperCase()}${name.slice(1)}' is, so I didn't reassign.`);
    }
    const dueMatch = /\b(?:due|deadline|by|before)\b\s*(?:to|on)?\s*(.+)$/.exec(lower);
    if (dueMatch) {
      const date = parseSpokenDate(dueMatch[1]);
      if (date) add("set_deadline", tasks.map((p) => p.id), { date });
      else warnings.push(`I couldn't understand the date '${dueMatch[1]}', so I didn't set a deadline.`);
    }
  }

  return { actions, warnings, preview: describePreviewWithNotes(pending, actions, warnings) };
}

function describePreviewWithNotes(pending: Proposal[], actions: ReviewAction[], warnings: string[]) {
  return [describePreview(pending, actions), ...warnings.map((w) => `Note: ${w}`)].join(" ");
}

/** Proposals whose title/text share the most meaningful words with the clause. */
function matchByContent(clause: string, pending: Proposal[], tasksOnly: boolean): Proposal[] {
  const wanted = words(clause).filter((w) => !STOP.has(w) && !(w in NUMBER_WORDS) && !MONTHS.includes(w.slice(0, 3)) && !/^\d/.test(w));
  const people = new Set(PEOPLE.flatMap((n) => words(n)));
  const terms = wanted.filter((w) => !people.has(w));
  if (!terms.length) return [];
  const scored = pending
    .filter((p) => !tasksOnly || p.kind === "notion_task")
    .map((p) => {
      const hay = new Set(words(`${payloadTitle(p) ?? ""} ${payloadText(p)} ${p.summary}`));
      return { p, score: terms.filter((t) => hay.has(t) || [...hay].some((h) => h.startsWith(t) && t.length > 3)).length };
    });
  const best = Math.max(0, ...scored.map((s) => s.score));
  return best ? scored.filter((s) => s.score === best).map((s) => s.p) : [];
}
