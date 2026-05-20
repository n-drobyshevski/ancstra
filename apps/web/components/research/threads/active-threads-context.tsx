'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ThreadListItem } from '@/lib/research/use-thread-list';

/**
 * Client-side context that holds the server-streamed promise of active
 * threads. The provider's wrapper RSC creates the promise via the
 * cached server loader; consumers (quick-switcher, header) resolve it
 * with React 19's `use()` hook inside their own <Suspense> boundary.
 *
 * Holding the *promise* rather than the resolved array means consumers
 * suspend exactly when they read it — usually only after the user opens
 * the popover, so the trigger button paints instantly.
 */
export const ActiveThreadsContext = createContext<Promise<ThreadListItem[]> | null>(null);

export function ActiveThreadsClientProvider({
  promise,
  children,
}: {
  promise: Promise<ThreadListItem[]>;
  children: ReactNode;
}) {
  return (
    <ActiveThreadsContext.Provider value={promise}>
      {children}
    </ActiveThreadsContext.Provider>
  );
}

/** Returns the promise; consumers call `use()` on it inside Suspense. */
export function useActiveThreadsPromise(): Promise<ThreadListItem[]> | null {
  return useContext(ActiveThreadsContext);
}
