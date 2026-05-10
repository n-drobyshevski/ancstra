import { useState, type Dispatch, type SetStateAction } from 'react';
import { useIsHydrated } from './use-is-hydrated';

/**
 * State that hydrates from a client-only source (localStorage, matchMedia,
 * other browser APIs) once after mount, without an effect.
 *
 * Equivalent to:
 *
 *   const [v, setV] = useState(initial);
 *   useEffect(() => { setV(computeClientValue()); }, []);
 *
 * — but uses `useIsHydrated` (a `useSyncExternalStore`-based signal that's
 * `false` during SSR + first client render, then flips to `true` after
 * hydration commits) to gate the in-render setState. This means the first
 * client render returns `initialValue` (matching SSR), and the computed
 * value only kicks in on the second render — *after* the DOM has been
 * reconciled with the server HTML — so no hydration mismatch warning.
 *
 * The same end state lands as quickly as the old `useEffect`-based version
 * (one extra render), but without the lint warning and without the
 * `typeof window` branching that React explicitly calls out as a hydration
 * footgun.
 */
export function useClientHydratedState<T>(
  initialValue: T,
  computeClientValue: () => T,
): [T, Dispatch<SetStateAction<T>>] {
  const isHydrated = useIsHydrated();
  const [value, setValue] = useState(initialValue);
  const [didHydrate, setDidHydrate] = useState(false);
  if (isHydrated && !didHydrate) {
    setDidHydrate(true);
    setValue(computeClientValue());
  }
  return [value, setValue];
}
