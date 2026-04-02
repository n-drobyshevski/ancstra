const STORAGE_KEY = 'ancstra:research-activity';
const MAX_ENTRIES = 20;

export interface ActivityEntry {
  type: 'search' | 'scrape' | 'paste';
  title: string;
  timestamp: number;
  resultCount?: number;
  itemId?: string;
}

export function getActivity(): ActivityEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addActivity(entry: Omit<ActivityEntry, 'timestamp'>): void {
  const current = getActivity();
  current.unshift({ ...entry, timestamp: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(0, MAX_ENTRIES)));
}

export function clearActivity(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/* ── Last workspace context ── */

const LAST_WORKSPACE_KEY = 'ancstra:last-workspace';

export interface LastWorkspace {
  personId: string;
  personName: string;
  view: string;
  timestamp: number;
}

export function getLastWorkspace(): LastWorkspace | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_WORKSPACE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setLastWorkspace(data: Omit<LastWorkspace, 'timestamp'>): void {
  localStorage.setItem(LAST_WORKSPACE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
}
