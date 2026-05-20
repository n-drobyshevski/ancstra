import type { ThreadListItem } from './use-thread-list';
import type { ThreadSortKey } from './threads-search-params';

// Pure helper for the thread-list view. Extracted so sort logic is
// unit-testable without mounting the React shell. (Search moved
// server-side — see `listThreads(db, { q })` in @ancstra/research.)

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
