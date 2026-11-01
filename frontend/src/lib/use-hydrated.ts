"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False during prerender and hydration, true right after. Suspense-wrapped components
 * (the sidebar) can hydrate after a shared query has already resolved, so cached data
 * must not be rendered until then or it won't match the server HTML (React error #418).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
