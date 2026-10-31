import type {
  Brief,
  BriefTopic,
  Commitment,
  LedgerConflict,
  LedgerDecision,
  LedgerLineage,
  LedgerTopic,
  Proposal,
} from "@/lib/types";

// The Tiffinly story, as the insight endpoints would tell it:
//   launch Nov 15 → Nov 30, Stripe → Razorpay, ₹1,499 → ₹999; the API spec (Pragti) pushed back twice;
//   the OTP login bug has no owner; Rahul's onboarding screens are done; GST invoices are an open question.

const KICKOFF = "Tiffinly Launch Kickoff";
const SYNC = "Tiffinly Weekly Sync";
const REVIEW = "Tiffinly Launch Review";
const D17 = "2026-10-17T15:00:00";
const D24 = "2026-10-24T15:00:00";
const D31 = "2026-10-31T15:00:00";

// ---- Decision ledger ------------------------------------------------------

const dec = (
  id: number,
  topic: string,
  statement: string,
  held_at: string,
  meeting_title: string,
  status: "current" | "superseded",
): LedgerDecision => ({ id, topic, statement, held_at, meeting_title, status, made_by: "Shrey Vohra" });

const launch = [
  dec(1, "Launch date", "Tiffinly launches on November 15.", D17, KICKOFF, "superseded"),
  dec(7, "Launch date", "Launch moves from November 15 to November 30.", D31, REVIEW, "current"),
];
const payments = [
  dec(2, "Payments provider", "Use Stripe for payments.", D17, KICKOFF, "superseded"),
  dec(8, "Payments provider", "Switch from Stripe to Razorpay for payments.", D31, REVIEW, "current"),
];
const pricing = [
  dec(3, "Pricing", "The monthly meal plan costs ₹1,499.", D17, KICKOFF, "superseded"),
  dec(9, "Pricing", "Monthly plan drops from ₹1,499 to ₹999.", D31, REVIEW, "current"),
];
const beta = [dec(4, "Beta cohort", "Recruit 200 beta users from college WhatsApp groups.", D17, KICKOFF, "current")];
const login = [dec(5, "Login method", "Users log in with a phone-number OTP.", D24, SYNC, "current")];
const slots = [
  dec(6, "Delivery slots", "Lunch-only deliveries at launch; dinner added after the first month.", D24, SYNC, "current"),
];

const GROUPS = [launch, payments, pricing, beta, login, slots];

const CONFLICTS: Record<string, LedgerConflict[]> = {
  "Launch date": [
    {
      decision_id: 7,
      related_decision_id: 1,
      old_value: "Nov 15",
      new_value: "Nov 30",
      explanation: "Payments work alone was going to eat a week, so the team chose a solid launch over an on-time one.",
    },
  ],
  "Payments provider": [
    {
      decision_id: 8,
      related_decision_id: 2,
      old_value: "Stripe",
      new_value: "Razorpay",
      explanation: "Stripe's India business verification stayed stuck for two weeks.",
    },
  ],
  Pricing: [
    {
      decision_id: 9,
      related_decision_id: 3,
      old_value: "₹1,499",
      new_value: "₹999",
      explanation: "Beta users kept saying ₹1,499 a month was too steep for students.",
    },
  ],
};

export const mockLedger = (): LedgerTopic[] =>
  GROUPS.map((g) => ({
    topic: g[0].topic!,
    current: g.find((d) => d.status === "current") ?? g[g.length - 1],
    history: g,
    has_conflict: g[0].topic! in CONFLICTS,
  }));

export function mockLineage(decisionId: string): LedgerLineage | null {
  const group = GROUPS.find((g) => g.some((d) => String(d.id) === decisionId));
  if (!group) return null;
  const topic = group[0].topic!;
  return { decision_id: Number(decisionId), topic, chain: group, conflicts: CONFLICTS[topic] ?? [] };
}

// ---- Commitments ----------------------------------------------------------

const h = (
  meeting_title: string,
  held_at: string,
  update_type: string,
  quote: string,
  extra: { deadline?: string | null; deadline_raw?: string | null } = {},
) => ({ meeting_title, held_at, update_type, quote, ...extra });

export const mockCommitments = (): Commitment[] => [
  {
    person_id: 1,
    name: "Shrey Vohra",
    committed: 4,
    completed: 1,
    open: 3,
    overdue: 0,
    total_rollovers: 0,
    follow_through_rate: 0.25,
    tasks: [
      {
        id: 3,
        title: "Recruit 200 beta users",
        status: "in_progress",
        deadline: "2026-11-05",
        deadline_raw: "first week of November",
        rollover_count: 0,
        history: [
          h(KICKOFF, D17, "committed", "I'll recruit 200 beta users from the college WhatsApp groups.", {
            deadline: "2026-11-05",
            deadline_raw: "first week of November",
          }),
          h(SYNC, D24, "in_progress", "About 60 signups from the WhatsApp groups so far."),
        ],
      },
      {
        id: 7,
        title: "Update pricing to ₹999 in the app and site",
        status: "open",
        deadline: "2026-11-04",
        deadline_raw: "November 4",
        rollover_count: 0,
        history: [
          h(REVIEW, D31, "committed", "I'll update the pricing in the app and on the site by November 4.", {
            deadline: "2026-11-04",
            deadline_raw: "November 4",
          }),
        ],
      },
      {
        id: 4,
        title: "Make the landing page live",
        status: "open",
        deadline: null,
        deadline_raw: "soon",
        rollover_count: 0,
        history: [
          h(REVIEW, D31, "committed", "I'll get it live soon, I just need to finish the copy.", {
            deadline: null,
            deadline_raw: "soon",
          }),
        ],
      },
      {
        id: 11,
        title: "Set up the beta WhatsApp group",
        status: "completed",
        deadline: "2026-10-20",
        deadline_raw: "October 20",
        rollover_count: 0,
        history: [
          h(KICKOFF, D17, "committed", "I'll set up a group for the beta testers this weekend.", {
            deadline: "2026-10-20",
            deadline_raw: "October 20",
          }),
          h(SYNC, D24, "completed", "The beta group is up and already has people in it."),
        ],
      },
    ],
  },
  {
    person_id: 2,
    name: "Pragti",
    committed: 3,
    completed: 1,
    open: 2,
    overdue: 0,
    total_rollovers: 2,
    follow_through_rate: 1 / 3,
    tasks: [
      {
        id: 1,
        title: "Write the API spec",
        status: "open",
        deadline: null,
        deadline_raw: "next week-ish",
        rollover_count: 2,
        history: [
          h(KICKOFF, D17, "committed", "I can have that to you by October 24.", {
            deadline: "2026-10-24",
            deadline_raw: "October 24",
          }),
          h(SYNC, D24, "recommitted", "Honestly, it slipped. I can finish it next week.", {
            deadline: "2026-10-31",
            deadline_raw: "next week",
          }),
          h(REVIEW, D31, "recommitted", "Let me say next week-ish and I'll actually mean it.", {
            deadline: null,
            deadline_raw: "next week-ish",
          }),
        ],
      },
      {
        id: 5,
        title: "Integrate Razorpay",
        status: "open",
        deadline: "2026-11-07",
        deadline_raw: "November 7",
        rollover_count: 0,
        history: [
          h(REVIEW, D31, "committed", "I can have the integration done by November 7.", {
            deadline: "2026-11-07",
            deadline_raw: "November 7",
          }),
        ],
      },
      {
        id: 12,
        title: "Wire up the onboarding screens",
        status: "completed",
        deadline: "2026-10-25",
        deadline_raw: "October 25",
        rollover_count: 0,
        history: [
          h(KICKOFF, D17, "committed", "Rahul and I will wire them up once the designs land.", {
            deadline: "2026-10-25",
            deadline_raw: "October 25",
          }),
          h(SYNC, D24, "completed", "I've started wiring them up. They look great."),
        ],
      },
    ],
  },
  {
    person_id: 3,
    name: "Rahul",
    committed: 1,
    completed: 1,
    open: 0,
    overdue: 0,
    total_rollovers: 0,
    follow_through_rate: 1,
    tasks: [
      {
        id: 2,
        title: "Design the onboarding screens",
        status: "completed",
        deadline: "2026-10-22",
        deadline_raw: "October 22",
        rollover_count: 0,
        history: [
          h(KICKOFF, D17, "committed", "Rahul needs to design the onboarding screens, by October 22.", {
            deadline: "2026-10-22",
            deadline_raw: "October 22",
          }),
          h(SYNC, D24, "completed", "Rahul shared the final screens yesterday."),
        ],
      },
    ],
  },
];

export const mockDigestProposals = (): Omit<Proposal, "id">[] => {
  const base = { run_id: "digest", meeting_id: null, status: "pending", result: null } as const;
  const rows: [string, string, string][] = [
    [
      "shrey@tiffinly.in",
      "Your week at Tiffinly: 3 open commitments",
      "Hi Shrey,\n\nHere's where your commitments stand:\n- Update pricing to ₹999 in the app and site, due Nov 4\n- Recruit 200 beta users, due Nov 5 (about 60 signed up so far)\n- Make the landing page live: no date yet, worth picking one\n\nNice work getting the beta group up and running.",
    ],
    [
      "pragti@tiffinly.in",
      "Your week at Tiffinly: Razorpay and the API spec",
      "Hi Pragti,\n\nA quick look at what's open for you:\n- Integrate Razorpay, due Nov 7\n- Write the API spec: it has moved twice, so a firm date would help everyone\n\nThanks for wiring up the onboarding screens so quickly.",
    ],
    [
      "rahul@tiffinly.in",
      "Your week at Tiffinly: all caught up",
      "Hi Rahul,\n\nYou're all caught up. The onboarding screens landed on time and unblocked the wiring work. Thank you!",
    ],
  ];
  return rows.map(([to, subject, body]) => ({
    ...base,
    kind: "email" as const,
    summary: `Email to ${to}: ${subject}`,
    payload: { to, subject, body, digest: true },
  }));
};

// ---- Briefs ---------------------------------------------------------------

type Kb = { match: RegExp; build: (topic: string) => BriefTopic };

const hist = (date: string, meeting_title: string, statement: string) => ({ date, meeting_title, statement });

const KB: Kb[] = [
  {
    match: /launch|date|ship|release|go.?live/i,
    build: (topic) => ({
      topic,
      current_decision: "Launch is November 30.",
      history: [
        hist("2026-10-17", KICKOFF, "Launch on November 15. (superseded)"),
        hist("2026-10-31", REVIEW, "Launch moves to November 30."),
      ],
      open_conflicts: ["The date moved 15 days. Anything promised to beta users for Nov 15 needs a new date."],
      open_tasks: [
        { title: "Make the landing page live", owner: "Shrey Vohra", deadline: null, status: "open", rollover_count: 0 },
        { title: "Recruit 200 beta users", owner: "Shrey Vohra", deadline: "2026-11-05", status: "in_progress", rollover_count: 0 },
      ],
      unresolved: ["The landing page has no firm date, only “soon”."],
      suggested_questions: [
        "Is November 30 firm, or does it depend on the Razorpay integration landing on Nov 7?",
        "Do beta users need to hear about the new date?",
      ],
    }),
  },
  {
    match: /pay|stripe|razorpay|checkout|billing/i,
    build: (topic) => ({
      topic,
      current_decision: "Payments run on Razorpay.",
      history: [
        hist("2026-10-17", KICKOFF, "Use Stripe for payments. (superseded)"),
        hist("2026-10-24", SYNC, "Pragti questioned Stripe's slow India onboarding; parked. (superseded)"),
        hist("2026-10-31", REVIEW, "Switch from Stripe to Razorpay."),
      ],
      open_conflicts: ["Stripe → Razorpay: the Oct 24 disagreement was parked, then settled by the switch."],
      open_tasks: [
        { title: "Integrate Razorpay", owner: "Pragti", deadline: "2026-11-07", status: "open", rollover_count: 0 },
      ],
      unresolved: ["Does the Stripe work already done get reused or dropped?"],
      suggested_questions: [
        "Is November 7 still realistic for the Razorpay integration?",
        "Can Razorpay produce GST invoices for us out of the box?",
      ],
    }),
  },
  {
    match: /pric|plan|₹|rupee|cost|subscription/i,
    build: (topic) => ({
      topic,
      current_decision: "The monthly plan costs ₹999.",
      history: [
        hist("2026-10-17", KICKOFF, "Monthly plan costs ₹1,499. (superseded)"),
        hist("2026-10-31", REVIEW, "Monthly plan drops to ₹999."),
      ],
      open_conflicts: ["A 33% cut. Anything shown to beta users at ₹1,499 needs updating."],
      open_tasks: [
        { title: "Update pricing to ₹999 in the app and site", owner: "Shrey Vohra", deadline: "2026-11-04", status: "open", rollover_count: 0 },
      ],
      unresolved: [],
      suggested_questions: ["Do existing beta signups keep a grandfathered price?"],
    }),
  },
  {
    match: /api|spec|contract|backend/i,
    build: (topic) => ({
      topic,
      current_decision: "No firm date: Pragti said “next week-ish”.",
      history: [
        hist("2026-10-17", KICKOFF, "Pragti owns the API spec, due Oct 24. (superseded)"),
        hist("2026-10-24", SYNC, "Pushed to the following week. (superseded)"),
        hist("2026-10-31", REVIEW, "Pushed again, to “next week-ish”."),
      ],
      open_conflicts: [],
      open_tasks: [
        { title: "Write the API spec", owner: "Pragti", deadline: "next week-ish", status: "open", rollover_count: 2 },
      ],
      unresolved: ["The spec has been pushed back twice and still has no date."],
      suggested_questions: [
        "What is blocking the API spec, and can anything come off Pragti's plate?",
        "Can we agree on a calendar date instead of “next week-ish”?",
      ],
    }),
  },
  {
    match: /otp|login|sign.?in|auth|bug/i,
    build: (topic) => ({
      topic,
      current_decision: "Users log in with a phone-number OTP.",
      history: [hist("2026-10-24", SYNC, "Phone-number OTP is the login method.")],
      open_conflicts: [],
      open_tasks: [{ title: "Fix the OTP login bug", owner: null, deadline: null, status: "open", rollover_count: 0 }],
      unresolved: [
        "Nobody owns the OTP login bug, and out-of-state numbers can't get a code.",
        "No deadline for the fix, even though it blocks signups.",
      ],
      suggested_questions: ["Who is taking the OTP login bug, and by when?"],
    }),
  },
  {
    match: /onboard|screen|design|\bui\b/i,
    build: (topic) => ({
      topic,
      current_decision: "Rahul's onboarding screens are final and being wired up.",
      history: [
        hist("2026-10-17", KICKOFF, "Rahul designs the onboarding screens by Oct 22. (superseded)"),
        hist("2026-10-24", SYNC, "Final screens delivered; wiring started."),
      ],
      open_conflicts: [],
      open_tasks: [],
      unresolved: [],
      suggested_questions: ["Is there anything Rahul can pick up next, like the OTP error states?"],
    }),
  },
  {
    match: /gst|invoice|tax/i,
    build: (topic) => ({
      topic,
      current_decision: null,
      history: [],
      open_conflicts: [],
      open_tasks: [],
      unresolved: ["No decision yet on whether invoices must include GST.", "Nobody has been asked to look into it."],
      suggested_questions: [
        "Do we need GST invoices at launch, or can they follow?",
        "Who can check what Razorpay provides out of the box?",
      ],
    }),
  },
  {
    match: /beta|user|recruit|signup/i,
    build: (topic) => ({
      topic,
      current_decision: "Recruit 200 beta users from college WhatsApp groups.",
      history: [
        hist("2026-10-17", KICKOFF, "Recruit 200 beta users. (superseded)"),
        hist("2026-10-24", SYNC, "About 60 signups so far."),
      ],
      open_conflicts: [],
      open_tasks: [
        { title: "Recruit 200 beta users", owner: "Shrey Vohra", deadline: "2026-11-05", status: "in_progress", rollover_count: 0 },
      ],
      unresolved: [],
      suggested_questions: ["Are we on pace for 200 by Nov 5?"],
    }),
  },
];

/** Splits a dictated or typed agenda into topics: one per line or bullet, else by commas / "and". */
export function splitAgenda(agenda: string): string[] {
  const clean = (s: string) => s.replace(/^[\s\-*•\d.)]+/, "").replace(/[.;]+$/, "").trim();
  let parts = agenda.split(/\n+/).map(clean).filter(Boolean);
  if (parts.length < 2) parts = agenda.split(/[;,]|\band\b/i).map(clean).filter(Boolean);
  return (parts.length ? parts : [clean(agenda)]).filter(Boolean).slice(0, 6);
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildMockBrief(agenda: string, id: number, meeting_at?: string): Brief {
  const topics = splitAgenda(agenda).map((raw) => {
    const topic = titleCase(raw);
    const hit = KB.find((k) => k.match.test(raw));
    return (
      hit?.build(topic) ?? {
        topic,
        current_decision: null,
        history: [],
        open_conflicts: [],
        open_tasks: [],
        unresolved: ["Nothing about this has come up in past meetings."],
        suggested_questions: [`What outcome do you want from “${topic}” in this meeting?`],
      }
    );
  });

  const changed = topics.filter((t) => t.open_conflicts.length && t.history.length > 1).map((t) => t.topic.toLowerCase());
  const slipped = topics.flatMap((t) => t.open_tasks).find((t) => t.rollover_count >= 2);
  const parts: string[] = [];
  if (changed.length) {
    const list = changed.length > 1 ? `${changed.slice(0, -1).join(", ")} and ${changed[changed.length - 1]}` : changed[0];
    parts.push(`${titleCase(list)} changed since Oct 17`);
  }
  if (slipped) parts.push(`${slipped.title.replace(/^Write the /, "the ")} has slipped ${slipped.rollover_count}×`);
  const headline = parts.length
    ? `${parts.join(", and ")}.`
    : "Nothing here conflicts with past decisions, but a few gaps are worth filling.";

  return { id, headline, topics, agenda, meeting_at: meeting_at ?? null, created_at: new Date().toISOString() };
}

export const seedBriefs = (): Brief[] => [
  {
    ...buildMockBrief("Launch date\nPayments\nPricing\nAPI spec\nGST invoices", 1, "2026-11-03T15:00:00"),
    created_at: "2026-10-31T09:10:00",
  },
];
