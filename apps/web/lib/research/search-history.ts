const STORAGE_KEY = 'ancstra:recent-searches';
const MAX_ENTRIES = 8;

export const EXAMPLE_SEARCHES = [
  'Maria Kowalski born 1885',
  'Chicago Tribune obituary 1952',
  'Census records Cook County IL',
  'Ship manifest Hamburg 1890',
];

export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  const current = getRecentSearches().filter((s) => s !== trimmed);
  current.unshift(trimmed);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(0, MAX_ENTRIES)));
}

export function removeSearch(query: string): void {
  const current = getRecentSearches().filter((s) => s !== query);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
