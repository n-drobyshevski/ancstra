/**
 * Persistent storage for the user's preferred node style ("wide" / "compact").
 *
 * The preference is decoupled from the saved tree layout: changing style is a
 * pure UI choice that should survive navigation and reloads independent of
 * whether the user has dragged any nodes. Layouts continue to store positions;
 * style is a per-browser user preference held in localStorage.
 *
 * Reads are SSR-safe and tolerate a missing or sandboxed localStorage.
 */
import type { NodeStyle } from '@/components/tree/tree-utils';

const STORAGE_KEY = 'ancstra-tree-node-style';

export function readNodeStylePreference(): NodeStyle | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'wide' || v === 'compact' ? v : null;
  } catch {
    return null;
  }
}

export function writeNodeStylePreference(style: NodeStyle): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded). Silent.
  }
}
