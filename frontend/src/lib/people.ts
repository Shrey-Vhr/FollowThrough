export type PersonTone = "violet" | "sky" | "pink" | "zinc";

export interface ResolvedPerson {
  /** Display name */
  name: string;
  /** Raw transcript label worth showing as a hint, e.g. "Speaker 2" for Pragti */
  hint?: string;
  initials: string;
  tone: PersonTone;
}

export const PERSON_CLASSES: Record<PersonTone, string> = {
  violet: "border-primary/30 bg-primary/10 text-[#a89fff]",
  sky: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  pink: "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300",
  zinc: "border-border bg-surface-2 text-muted-foreground",
};

export const PERSON_DOT: Record<PersonTone, string> = {
  violet: "bg-primary",
  sky: "bg-sky-400",
  pink: "bg-fuchsia-400",
  zinc: "bg-zinc-500",
};

const KNOWN: Record<string, { name: string; tone: PersonTone; hint?: string }> = {
  "shrey vohra": { name: "Shrey Vohra", tone: "violet" },
  shrey: { name: "Shrey Vohra", tone: "violet" },
  "speaker 2": { name: "Pragti", tone: "sky", hint: "Speaker 2" },
  pragti: { name: "Pragti", tone: "sky" },
  rahul: { name: "Rahul", tone: "pink" },
};

/** Maps a transcript speaker label or owner name to one consistent name, initials and color. */
export function resolvePerson(label: string): ResolvedPerson {
  const key = label.replace(/\s*\(.*?\)\s*$/, "").trim().toLowerCase();
  const known = KNOWN[key];
  const name = known?.name ?? label.trim();
  const parts = name.split(/\s+/);
  const initials = (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
  return { name, hint: known?.hint, initials, tone: known?.tone ?? "zinc" };
}

export function firstName(label: string): string {
  return resolvePerson(label).name.split(/\s+/)[0];
}
