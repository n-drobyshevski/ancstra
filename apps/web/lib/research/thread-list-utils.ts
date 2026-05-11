import type { ThreadListItem } from './use-thread-list';
import type { ThreadSortKey } from './threads-search-params';

// Pure helpers for the thread-list view. Extracted so the sort/filter
// logic is unit-testable without mounting the React shell.

export function applyThreadSort(threads: ThreadListItem[], key: ThreadSortKey): ThreadListItem[] {
  const copy = threads.slice();
  switch (key) {
    case 'updated':
      copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      break;
    case 'created':
      copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case 'title':
      copy.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }
  return copy;
}

export function applyThreadSearch(threads: ThreadListItem[], rawQuery: string): ThreadListItem[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return threads;
  return threads.filter(t =>
    t.title.toLowerCase().includes(q) ||
    (t.summary ?? '').toLowerCase().includes(q),
  );
}
