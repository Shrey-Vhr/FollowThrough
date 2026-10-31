"use client";

import { useSyncExternalStore } from "react";
import { MOCK_TODAY, USE_MOCKS } from "./config";

// Cached so every render sees the same Date (required by useSyncExternalStore) and so
// time-dependent UI never renders during prerender, avoiding hydration mismatches.
let today: Date | null = null;
let now: Date | null = null;
const noop = () => () => {};

/** "Today" for relative dates: pinned in mock mode, the real date otherwise. Null on the server. */
export function useToday(): Date | null {
  return useSyncExternalStore(
    noop,
    () => (today ??= USE_MOCKS ? MOCK_TODAY : new Date()),
    () => null,
  );
}

/** The real current time, for the greeting. Null on the server. */
export function useNow(): Date | null {
  return useSyncExternalStore(noop, () => (now ??= new Date()), () => null);
}
