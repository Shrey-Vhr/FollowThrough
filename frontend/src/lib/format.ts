const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Date-only ISO strings are parsed as local dates so they never shift across time zones. */
export function parseDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

export function formatShortDate(value: string): string {
  const d = parseDate(value);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatLongDate(value: string): string {
  const d = parseDate(value);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const h = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${time}`;
}

export function daysUntil(deadline: string, today: Date): number {
  const a = parseDate(deadline).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

export interface RelativeDue {
  label: string;
  tone: "overdue" | "soon" | "normal";
}

export function relativeDue(deadline: string, today: Date): RelativeDue {
  const n = daysUntil(deadline, today);
  if (n < -1) return { label: `${-n} days overdue`, tone: "overdue" };
  if (n === -1) return { label: "Yesterday", tone: "overdue" };
  if (n === 0) return { label: "Today", tone: "soon" };
  if (n === 1) return { label: "Tomorrow", tone: "soon" };
  return { label: `In ${n} days`, tone: n <= 3 ? "soon" : "normal" };
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
