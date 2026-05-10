import { useState, type Dispatch, type SetStateAction } from 'react';

/**
 * State that hydrates from a client-only source (localStorage, matchMedia,
 * other browser APIs) once after mount, without an effect.
 *
 * Equivalent to:
 *
 *   const [v, setV] = useState(initial);
 *   useEffect(() => { setV(computeClientValue()); }, []);
 *
 * — but uses the React 19 "store info from previous renders" idiom so it
 * doesn't trip `react-hooks/set-state-in-effect`, avoids the cascading
 * render the effect-based version causes, and runs synchronously with
 * the first commit instead of after.
 *
 * SSR safety: `computeClientValue` only runs when `typeof window !== 'undefined'`,
 * so the server render uses `initialValue` and the first client render
 * matches it (no hydration mismatch). The hydrated value appears on the
 * second render, before paint.
 */
export function useClientHydratedState<T>(
  initialValue: T,
  computeClientValue: () => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && typeof window !== 'undefined') {
    setHydrated(true);
    setValue(computeClientValue());
  }
  return [value, setValue];
}
