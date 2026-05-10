import { useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Local, editable state that resets whenever the upstream source changes.
 *
 * Useful for inputs whose canonical value lives in a URL search-param or
 * parent-controlled prop, but which need a debounced/buffered local copy
 * during typing. Equivalent to:
 *
 *   const [v, setV] = useState(source);
 *   useEffect(() => setV(source), [source]);
 *
 * — but implemented with the React 19 "store info from previous renders"
 * idiom so it doesn't trip `react-hooks/set-state-in-effect` and avoids the
 * extra render the effect-based version causes.
 *
 * @see https://react.dev/reference/react/useState#storing-information-from-previous-renders
 */
export function useDerivedState<T>(source: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(source);
  const [prevSource, setPrevSource] = useState(source);
  if (source !== prevSource) {
    setPrevSource(source);
    setValue(source);
  }
  return [value, setValue];
}
