/**
 * Persistent per-browser storage for tree-view UI preferences.
 *
 * Mirrors the pattern in `node-style-storage.ts`: each pref is its own
 * key. Reads are SSR-safe and tolerate a missing/sandboxed localStorage,
 * returning `null` so the caller can apply a default.
 *
 * Naming convention: `ancstra-tree-<kebab-case>`.
 */

export type Coloring = 'off' | 'generation' | 'branch' | 'living';
export type ColoringStyle = 'fill' | 'border';
export type EdgeStyle = 'curved' | 'stepped' | 'straight';

const KEY_SHOW_DATES = 'ancstra-tree-show-dates';
const KEY_SHOW_LIVING_INDICATOR = 'ancstra-tree-show-living-indicator';
const KEY_SHOW_MINIMAP = 'ancstra-tree-show-minimap';
const KEY_SHOW_DATA_QUALITY = 'ancstra-tree-show-data-quality';
const KEY_SHOW_PROPOSALS = 'ancstra-tree-show-proposals';
const KEY_SHOW_CITATIONS = 'ancstra-tree-show-citations';
const KEY_COLORING = 'ancstra-tree-coloring';
const KEY_COLORING_STYLE = 'ancstra-tree-coloring-style';
const KEY_EDGES = 'ancstra-tree-edges';

function readBool(key: string): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(key);
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

function writeBool(key: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // localStorage may be unavailable. Silent.
  }
}

export const readShowDates = () => readBool(KEY_SHOW_DATES);
export const writeShowDates = (v: boolean) => writeBool(KEY_SHOW_DATES, v);

export const readShowLivingIndicator = () => readBool(KEY_SHOW_LIVING_INDICATOR);
export const writeShowLivingIndicator = (v: boolean) =>
  writeBool(KEY_SHOW_LIVING_INDICATOR, v);

export const readShowMinimap = () => readBool(KEY_SHOW_MINIMAP);
export const writeShowMinimap = (v: boolean) => writeBool(KEY_SHOW_MINIMAP, v);

export const readShowDataQuality = () => readBool(KEY_SHOW_DATA_QUALITY);
export const writeShowDataQuality = (v: boolean) =>
  writeBool(KEY_SHOW_DATA_QUALITY, v);

export const readShowProposals = () => readBool(KEY_SHOW_PROPOSALS);
export const writeShowProposals = (v: boolean) => writeBool(KEY_SHOW_PROPOSALS, v);

export const readShowCitations = () => readBool(KEY_SHOW_CITATIONS);
export const writeShowCitations = (v: boolean) =>
  writeBool(KEY_SHOW_CITATIONS, v);

export function readColoring(): Coloring | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(KEY_COLORING);
    return v === 'off' || v === 'generation' || v === 'branch' || v === 'living'
      ? v
      : null;
  } catch {
    return null;
  }
}

export function writeColoring(value: Coloring): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_COLORING, value);
  } catch {
    // Silent.
  }
}

export function readColoringStyle(): ColoringStyle | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(KEY_COLORING_STYLE);
    return v === 'fill' || v === 'border' ? v : null;
  } catch {
    return null;
  }
}

export function writeColoringStyle(value: ColoringStyle): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_COLORING_STYLE, value);
  } catch {
    // Silent.
  }
}

export function readEdgeStyle(): EdgeStyle | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(KEY_EDGES);
    return v === 'curved' || v === 'stepped' || v === 'straight' ? v : null;
  } catch {
    return null;
  }
}

export function writeEdgeStyle(value: EdgeStyle): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_EDGES, value);
  } catch {
    // Silent.
  }
}
