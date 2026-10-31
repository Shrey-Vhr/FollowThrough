export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Mocks are on unless explicitly disabled with NEXT_PUBLIC_USE_MOCKS=false. */
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

/** "Today" in mock mode, so relative dates line up with the seeded meetings (Oct 17/24/31). */
export const MOCK_TODAY = new Date(2026, 9, 31);

/** Shows the demo-only "Simulate time" control on the Dashboard. */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
