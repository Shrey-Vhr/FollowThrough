import {
  BookMarked,
  CalendarDays,
  FileText,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: number;
}

export const NAV: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    subtitle: "Where every meeting stands, at a glance.",
  },
  {
    href: "/meetings",
    label: "Meetings",
    icon: CalendarDays,
    title: "Meetings",
    subtitle: "Transcripts imported from Wispr Notetaker.",
  },
  {
    href: "/ledger",
    label: "Decision Ledger",
    icon: BookMarked,
    title: "Decision Ledger",
    subtitle: "Every decision, across every meeting.",
  },
  {
    href: "/review",
    label: "Review Queue",
    icon: ShieldCheck,
    title: "Review Queue",
    subtitle: "Nothing is sent until you approve it.",
    badge: 0, // placeholder until proposals are wired up
  },
  {
    href: "/briefs",
    label: "Briefs",
    icon: FileText,
    title: "Briefs",
    subtitle: "Pre-meeting context, generated from past meetings.",
  },
  {
    href: "/commitments",
    label: "Commitments",
    icon: ListChecks,
    title: "Commitments",
    subtitle: "Who promised what, and by when.",
  },
];

export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function navFor(pathname: string): NavItem {
  return NAV.find((n) => isActive(n.href, pathname)) ?? NAV[0];
}
