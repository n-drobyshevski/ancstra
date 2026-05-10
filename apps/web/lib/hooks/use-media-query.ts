import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a `window.matchMedia` query without using `useEffect`. The
 * canonical `useSyncExternalStore` example: the media query list IS an
 * external store (the browser), and React 19's lint rule recognizes this
 * as the right primitive — no `react-hooks/set-state-in-effect`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      if (typeof window === 'undefined') return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
