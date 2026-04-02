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
