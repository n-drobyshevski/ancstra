import * as React from 'react';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Returns `false` during SSR and the very first client render, then `true`
 * after hydration completes. Use to gate values that differ between server
 * and client (e.g. tRPC `useQuery` flags like `isFetching`/`isLoading`
 * which can evaluate differently on the two sides and cause hydration
 * warnings on attributes such as `disabled`).
 *
 * Implemented with `useSyncExternalStore` so it never reads/writes refs
 * during render and doesn't trip the `react-hooks/set-state-in-effect`
 * lint rule.
 */
export function useIsHydrated(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
