import type {
  Decision,
  Issue,
  MeetingDetail,
  Proposal,
  Segment,
  Task,
  WisprMeeting,
} from "@/lib/types";

const SHREY = { speaker: "Shrey Vohra", person_id: 1 };
const P2 = { speaker: "Speaker 2", person_id: 2 };

/** Builds numbered segments from [speaker, text] pairs. */
function lines(base: number, rows: [typeof SHREY, string][]): Segment[] {
  return rows.map(([who, text], i) => ({ id: base + i + 1, ...who, text }));
}

// ---- Meeting 1: Launch Kickoff (Oct 17) ---------------------------------

const m1Segments = lines(100, [
  [SHREY, "Okay, recording's on. Thanks for jumping in. This is the Tiffinly launch kickoff, so I want to leave today with a launch date, a payments plan, and a price."],
  [P2, "Sounds good. I've been through the backend scope. If we freeze features this week, I think we can be ready by mid-November."],
  [SHREY, "Then let's lock it. We launch on November 15. That gives us four weeks, and it lines up with the semester break so students are around."],
  [P2, "Fine by me. For payments I'd go with Stripe, I've integrated it before and the docs are good."],
  [SHREY, "Agreed, we'll use Stripe for payments. Let's not overthink it."],
  [P2, "On pricing, what are we charging for the monthly meal plan?"],
  [SHREY, "I've run the numbers on food cost and delivery. The monthly plan will be ₹1,499. Per meal that's still cheaper than ordering out."],
  [P2, "Okay. And the first users? We need real people on this before launch."],
  [SHREY, "I'll recruit 200 beta users from the college WhatsApp groups. Targeting the first week of November."],
  [P2, "I'll write the API spec so Rahul and I are building against the same contract. I can have that to you by October 24."],
  [SHREY, "Perfect. And Rahul needs to design the onboarding screens, by October 22, so you can wire them up."],
  [P2, "Got it. I'll ping Rahul today."],
  [SHREY, "Great. Let's reconvene in a week for a sync."],
]);

const m1Decisions: Decision[] = [
  { id: 1, topic: "Launch date", statement: "Tiffinly launches on November 15.", made_by: "Shrey Vohra", source_quote: "We launch on November 15.", status: "superseded" },
  { id: 2, topic: "Payments provider", statement: "Use Stripe for payments.", made_by: "Shrey Vohra", source_quote: "we'll use Stripe for payments.", status: "superseded" },
  { id: 3, topic: "Pricing", statement: "The monthly meal plan costs ₹1,499.", made_by: "Shrey Vohra", source_quote: "The monthly plan will be ₹1,499.", status: "superseded" },
  { id: 4, topic: "Beta cohort", statement: "Recruit 200 beta users from college WhatsApp groups.", made_by: "Shrey Vohra", source_quote: "I'll recruit 200 beta users from the college WhatsApp groups.", status: "active" },
];

const apiSpecQuote = "I can have that to you by October 24.";
const m1Tasks: Task[] = [
  { id: 1, title: "Write the API spec", owner_id: 2, owner_name: "Pragti", deadline: "2026-10-24", deadline_raw: "October 24", deadline_confidence: "exact", status: "open", rollover_count: 0, source_quote: apiSpecQuote },
  { id: 2, title: "Design the onboarding screens", owner_id: 3, owner_name: "Rahul", deadline: "2026-10-22", deadline_raw: "October 22", deadline_confidence: "exact", status: "open", rollover_count: 0, source_quote: "Rahul needs to design the onboarding screens, by October 22" },
  { id: 3, title: "Recruit 200 beta users", owner_id: 1, owner_name: "Shrey Vohra", deadline: "2026-11-05", deadline_raw: "first week of November", deadline_confidence: "inferred", status: "open", rollover_count: 0, source_quote: "I'll recruit 200 beta users from the college WhatsApp groups." },
];

// ---- Meeting 2: Weekly Sync (Oct 24) ------------------------------------

const m2Segments = lines(200, [
  [SHREY, "Okay, weekly sync. Let's go through where we are. Rahul's onboarding screens first."],
  [P2, "Rahul shared the final screens yesterday. They look great, I've started wiring them up."],
  [SHREY, "Nice, so onboarding screens are done. How's the API spec?"],
  [P2, "Honestly, it slipped. I got pulled into debugging the menu sync. I can finish it next week."],
  [SHREY, "Okay, let's push the API spec to next week then."],
  [SHREY, "Beta recruiting is going well, by the way. About 60 signups from the WhatsApp groups so far."],
  [SHREY, "On login, I think phone-number OTP is the way to go. Students don't all have the same email habits."],
  [P2, "Agreed, OTP login via phone number. I'd also want to restrict delivery slots for launch, we can't handle dinner and lunch both."],
  [SHREY, "Right, lunch only at launch. We'll add dinner after the first month."],
  [P2, "On payments though, I keep reading that Stripe's India onboarding is slow for new businesses. I'm not sure it's the right call."],
  [SHREY, "Hmm. I'd rather not switch now, we've already planned around it. Let's park that and revisit."],
  [P2, "Okay. Same time next week?"],
  [SHREY, "Yes."],
]);

const m2Decisions: Decision[] = [
  { id: 5, topic: "Login method", statement: "Users log in with a phone-number OTP.", made_by: "Shrey Vohra", source_quote: "phone-number OTP is the way to go", status: "active" },
  { id: 6, topic: "Delivery slots", statement: "Lunch-only deliveries at launch; dinner added after the first month.", made_by: "Shrey Vohra", source_quote: "lunch only at launch", status: "active" },
];

const m2Tasks: Task[] = [
  { ...m1Tasks[0], deadline: "2026-10-31", deadline_raw: "next week", deadline_confidence: "inferred", rollover_count: 1, source_quote: "I can finish it next week." },
  { ...m1Tasks[1], status: "completed", source_quote: "Rahul shared the final screens yesterday." },
  { ...m1Tasks[2], status: "in_progress", source_quote: "About 60 signups from the WhatsApp groups so far." },
];

// ---- Meeting 3: Launch Review (Oct 31) ----------------------------------

const m3Segments = lines(300, [
  [SHREY, "Alright, launch review. We're two weeks out from the 15th, so let's be honest about where things stand."],
  [P2, "Honest answer: we're not going to make November 15. The payments work alone is going to eat a week."],
  [SHREY, "Yeah, I've been thinking the same. Let's move the launch to November 30. It gives us breathing room and we still catch the winter break crowd."],
  [P2, "November 30 works. I'd rather launch solid than launch on time."],
  [P2, "On payments, Stripe's India onboarding is still stuck on business verification. I've been going back and forth with them for two weeks."],
  [SHREY, "Then we switch. Let's go with Razorpay instead of Stripe. You said the Razorpay docs are fine?"],
  [P2, "They're good, and sandbox access is instant. I can have the integration done by November 7."],
  [SHREY, "Great, so Pragti owns the Razorpay integration, due November 7."],
  [SHREY, "Pricing. Beta users keep telling me ₹1,499 a month is too steep for students."],
  [P2, "What did you have in mind?"],
  [SHREY, "Let's drop the monthly plan to ₹999. We make it up on volume. I'll update the pricing in the app and on the site by November 4."],
  [P2, "That's a big cut. But okay, if the beta numbers say so."],
  [SHREY, "They do. ₹999 it is."],
  [SHREY, "API spec, where are we?"],
  [P2, "I know, I know. It's the third time. Let me say next week-ish and I'll actually mean it."],
  [SHREY, "Okay, API spec, next week-ish."],
  [SHREY, "Landing page. I'll get it live soon, I just need to finish the copy."],
  [P2, "Soon isn't a date, but fine."],
  [SHREY, "Fair. One more thing: users with out-of-state numbers can't get the OTP on login. That's a real bug."],
  [P2, "Yeah, I saw that in the beta channel. Somebody should fix the OTP login bug before launch."],
  [SHREY, "Agreed, someone should fix it. We'll sort out who."],
  [P2, "Okay. Wrapping up: launch November 30, Razorpay, ₹999."],
  [SHREY, "That's the summary. Thanks everyone."],
]);

const m3Decisions: Decision[] = [
  { id: 7, topic: "Launch date", statement: "Launch moves from November 15 to November 30.", made_by: "Shrey Vohra", source_quote: "Let's move the launch to November 30.", status: "active" },
  { id: 8, topic: "Payments provider", statement: "Switch from Stripe to Razorpay for payments.", made_by: "Shrey Vohra", source_quote: "Let's go with Razorpay instead of Stripe.", status: "active" },
  { id: 9, topic: "Pricing", statement: "Monthly plan drops from ₹1,499 to ₹999.", made_by: "Shrey Vohra", source_quote: "Let's drop the monthly plan to ₹999.", status: "active" },
];

const m3Tasks: Task[] = [
  { id: 1, title: "Write the API spec", owner_id: 2, owner_name: "Pragti", deadline: null, deadline_raw: "next week-ish", deadline_confidence: "vague", status: "open", rollover_count: 2, source_quote: "Let me say next week-ish and I'll actually mean it." },
  { id: 4, title: "Make the landing page live", owner_id: 1, owner_name: "Shrey Vohra", deadline: null, deadline_raw: "soon", deadline_confidence: "vague", status: "open", rollover_count: 0, source_quote: "I'll get it live soon, I just need to finish the copy." },
  { id: 5, title: "Integrate Razorpay", owner_id: 2, owner_name: "Pragti", deadline: "2026-11-07", deadline_raw: "November 7", deadline_confidence: "exact", status: "open", rollover_count: 0, source_quote: "I can have the integration done by November 7." },
  { id: 6, title: "Fix the OTP login bug", owner_id: null, owner_name: null, deadline: null, deadline_raw: null, deadline_confidence: "none", status: "open", rollover_count: 0, source_quote: "Somebody should fix the OTP login bug before launch." },
  { id: 7, title: "Update pricing to ₹999 in the app and site", owner_id: 1, owner_name: "Shrey Vohra", deadline: "2026-11-04", deadline_raw: "November 4", deadline_confidence: "exact", status: "open", rollover_count: 0, source_quote: "I'll update the pricing in the app and on the site by November 4." },
];

const M3 = { meeting_id: 3, meeting_title: "Tiffinly Launch Review" };
const m3Issues: Issue[] = [
  {
    id: 2, type: "conflict", status: "open", ...M3,
    title: "Launch date moved from Nov 15 to Nov 30",
    details: {
      past: { statement: "Tiffinly launches on November 15.", meeting_title: "Tiffinly Launch Kickoff", held_at: "2026-10-17", source_quote: "We launch on November 15." },
      new: { statement: "Launch moves to November 30.", meeting_title: "Tiffinly Launch Review", held_at: "2026-10-31", source_quote: "Let's move the launch to November 30." },
      explanation: "The launch slipped by 15 days. Payments work is the stated cause, so the Razorpay and pricing changes below likely belong with this one.",
      confidence: 0.97,
    },
  },
  {
    id: 3, type: "conflict", status: "open", ...M3,
    title: "Payments provider switched from Stripe to Razorpay",
    details: {
      past: { statement: "Use Stripe for payments.", meeting_title: "Tiffinly Launch Kickoff", held_at: "2026-10-17", source_quote: "we'll use Stripe for payments." },
      new: { statement: "Switch to Razorpay for payments.", meeting_title: "Tiffinly Launch Review", held_at: "2026-10-31", source_quote: "Let's go with Razorpay instead of Stripe." },
      explanation: "Stripe was chosen on Oct 17. Pragti raised concerns on Oct 24, and Stripe's India verification is still stalled, so the team is replacing it.",
      confidence: 0.98,
    },
  },
  {
    id: 4, type: "conflict", status: "open", ...M3,
    title: "Monthly plan price cut from ₹1,499 to ₹999",
    details: {
      past: { statement: "The monthly meal plan costs ₹1,499.", meeting_title: "Tiffinly Launch Kickoff", held_at: "2026-10-17", source_quote: "The monthly plan will be ₹1,499." },
      new: { statement: "Monthly plan drops to ₹999.", meeting_title: "Tiffinly Launch Review", held_at: "2026-10-31", source_quote: "Let's drop the monthly plan to ₹999." },
      explanation: "A 33% price cut. Anything already shown to beta users at ₹1,499 needs updating.",
      confidence: 0.95,
    },
  },
  {
    id: 5, type: "vague_deadline", status: "open", ...M3,
    title: "No firm date for 'Make the landing page live'",
    details: { task_title: "Make the landing page live", owner: "Shrey Vohra", deadline_raw: "soon" },
  },
  {
    id: 6, type: "vague_deadline", status: "open", ...M3,
    title: "No firm date for 'Write the API spec'",
    details: { task_title: "Write the API spec", owner: "Pragti", deadline_raw: "next week-ish" },
  },
  {
    id: 7, type: "missing_owner", status: "open", ...M3,
    title: "Nobody owns 'Fix the OTP login bug'",
    details: { task_title: "Fix the OTP login bug", deadline_raw: null },
  },
];

const m2Issues: Issue[] = [
  {
    id: 1, type: "disagreement", status: "resolved", meeting_id: 2, meeting_title: "Tiffinly Weekly Sync",
    title: "Unresolved disagreement: payments provider",
    details: {
      topic: "Payments provider",
      positions: [
        { person: "Pragti", view: "Stripe's India onboarding is slow; reconsider the provider." },
        { person: "Shrey Vohra", view: "Stay on Stripe; the plan is already built around it." },
      ],
      source_quote: "I'm not sure it's the right call.",
    },
  },
];

// ---- Wispr import: a meeting that appears after importing ----------------

export const vendorCallSegments = lines(400, [
  [SHREY, "Thanks for hopping on. We're comparing two kitchen partners for launch: Sunrise Kitchens and Dabba Co."],
  [P2, "Sunrise can do 300 meals a day at launch, and Dabba Co. tops out at 150."],
  [SHREY, "Capacity matters most. Let's go with Sunrise Kitchens as our launch partner."],
  [P2, "Their minimum order is 50 meals per slot, which is fine for lunch."],
  [SHREY, "I'll ask Sunrise for a tasting box by November 10."],
  [P2, "I'll review their food safety certificate and send over the contract."],
  [SHREY, "Great. When can you have that?"],
  [P2, "Early next month, probably."],
  [SHREY, "Okay, let's keep moving."],
]);

export const vendorCallAnalysis = {
  decisions: [
    { id: 10, topic: "Kitchen partner", statement: "Sunrise Kitchens is the launch kitchen partner.", made_by: "Shrey Vohra", source_quote: "Let's go with Sunrise Kitchens as our launch partner.", status: "active" },
  ] satisfies Decision[],
  tasks: [
    { id: 8, title: "Get a tasting box from Sunrise Kitchens", owner_id: 1, owner_name: "Shrey Vohra", deadline: "2026-11-10", deadline_raw: "November 10", deadline_confidence: "exact", status: "open", rollover_count: 0, source_quote: "I'll ask Sunrise for a tasting box by November 10." },
    { id: 9, title: "Review food safety certificate and send contract", owner_id: 2, owner_name: "Pragti", deadline: null, deadline_raw: "early next month", deadline_confidence: "vague", status: "open", rollover_count: 0, source_quote: "Early next month, probably." },
  ] satisfies Task[],
  issues: (meetingId: number, title: string): Issue[] => [
    {
      id: 8, type: "vague_deadline", status: "open", meeting_id: meetingId, meeting_title: title,
      title: "No firm date for 'Review food safety certificate and send contract'",
      details: { task_title: "Review food safety certificate and send contract", owner: "Pragti", deadline_raw: "early next month" },
    },
  ],
};

// ---- Assembled ----------------------------------------------------------

export const seedMeetings = (): MeetingDetail[] => [
  {
    id: 1, title: "Tiffinly Launch Kickoff", held_at: "2026-10-17T15:00:00", source: "wispr", status: "processed",
    wispr_summary: "Locked a November 15 launch, Stripe for payments and a ₹1,499 monthly plan. Beta recruiting and the API spec are underway.",
    segments: m1Segments, decisions: m1Decisions, tasks: m1Tasks, issues: [],
  },
  {
    id: 2, title: "Tiffinly Weekly Sync", held_at: "2026-10-24T15:00:00", source: "wispr", status: "processed",
    wispr_summary: "Onboarding screens are done and the API spec slipped a week. Phone-number OTP login and lunch-only slots agreed; payments provider debated.",
    segments: m2Segments, decisions: m2Decisions, tasks: m2Tasks, issues: m2Issues,
  },
  {
    id: 3, title: "Tiffinly Launch Review", held_at: "2026-10-31T15:00:00", source: "wispr", status: "processed",
    wispr_summary: "Launch pushed to November 30. Switching to Razorpay and dropping the monthly plan to ₹999. API spec slipped again; OTP bug has no owner.",
    segments: m3Segments, decisions: m3Decisions, tasks: m3Tasks, issues: m3Issues,
  },
];

export const seedWispr = (): WisprMeeting[] => [
  { wispr_meeting_id: "wm_41c7", title: "Tiffinly Kitchen Partners Call", start: "2026-11-01T11:30:00", has_transcript: true, summary_excerpt: "Compared Sunrise Kitchens and Dabba Co. on capacity, minimum orders and food-safety paperwork. Leaning Sunrise for the launch cohort.", already_imported: false },
  { wispr_meeting_id: "wm_52d0", title: "Founders catch-up", start: "2026-11-01T09:00:00", has_transcript: false, summary_excerpt: "Transcript is still processing.", already_imported: false },
  { wispr_meeting_id: "wm_9f31", title: "Tiffinly Launch Review", start: "2026-10-31T15:00:00", has_transcript: true, summary_excerpt: "Launch moved to Nov 30. Switching to Razorpay, monthly plan dropping to ₹999, and the OTP bug needs an owner.", already_imported: true },
  { wispr_meeting_id: "wm_7a02", title: "Tiffinly Weekly Sync", start: "2026-10-24T15:00:00", has_transcript: true, summary_excerpt: "Onboarding screens done, API spec pushed a week. Agreed on phone-number OTP and lunch-only slots.", already_imported: true },
  { wispr_meeting_id: "wm_1b66", title: "Tiffinly Launch Kickoff", start: "2026-10-17T15:00:00", has_transcript: true, summary_excerpt: "Fixed the Nov 15 launch, Stripe payments and ₹1,499 monthly pricing.", already_imported: true },
];

const base = { run_id: "run_demo", meeting_id: 3, status: "pending", result: null } as const;

/** Six pending Tiffinly proposals from the Launch Review (display_no is assigned by the mock API). */
export const seedProposals = (): Proposal[] => [
  { ...base, id: 1, kind: "notion_task", summary: "Create task: Integrate Razorpay → Pragti, due 2026-11-20", payload: { title: "Integrate Razorpay", owner: "Pragti", due_date: "2026-11-20", source_quote: "We're moving to Razorpay. Pragti, can you take the integration?" } },
  { ...base, id: 2, kind: "notion_task", summary: "Create task: Make landing page live → Shrey Vohra, due no date", payload: { title: "Make landing page live", owner: "Shrey Vohra", due_date: null, source_quote: "I'll get the landing page live once pricing is final." } },
  { ...base, id: 3, kind: "slack_message", summary: "Slack to #tiffinly: Nobody owns 'Fix OTP login bug' yet — who can take it?", payload: { channel: "#tiffinly", text: "Nobody owns 'Fix OTP login bug' yet — who can take it?" } },
  { ...base, id: 4, kind: "slack_message", summary: "Slack to @Pragti: Can you confirm a date for 'Finish API spec'?", payload: { user: "@Pragti", text: "Can you confirm a date for 'Finish API spec'?" } },
  { ...base, id: 5, kind: "slack_message", summary: "Slack to #tiffinly: Launch Review summary: 3 conflicts found…", payload: { channel: "#tiffinly", text: "Launch Review summary: 3 conflicts found — launch date (Nov 15 → Nov 30), payments (Stripe → Razorpay) and pricing (₹1,499 → ₹999)." } },
  { ...base, id: 6, kind: "notion_task", summary: "Create task: Fix OTP login bug → no owner, due no date", payload: { title: "Fix OTP login bug", owner: null, due_date: null, source_quote: "The OTP login bug is blocking signups and nobody owns it." } },
];
