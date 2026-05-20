import { describe, it, expect } from 'vitest';
import { applyThreadSort } from '@/lib/research/thread-list-utils';
import type { ThreadListItem } from '@/lib/research/use-thread-list';

function mk(overrides: Partial<ThreadListItem>): ThreadListItem {
  return {
    id: overrides.id ?? 't1',
    title: overrides.title ?? 'Untitled',
    status: overrides.status ?? 'active',
    summary: overrides.summary ?? null,
    seedPersonId: null,
    seedFactsheetId: null,
    seedResearchItemId: null,
    createdBy: 'u1',
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
    closedAt: null,
    ...overrides,
  };
}

describe('applyThreadSort', () => {
  const a = mk({ id: 'a', title: 'Carl',    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' });
  const b = mk({ id: 'b', title: 'Anna',    createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z' });
  const c = mk({ id: 'c', title: 'Bjorn',   createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-05-10T00:00:00.000Z' });

  it('sorts by updatedAt descending by default ("updated")', () => {
    const out = applyThreadSort([a, b, c], 'updated');
    expect(out.map(t => t.id)).toEqual(['c', 'a', 'b']);
  });

  it('sorts by createdAt descending for "created"', () => {
    const out = applyThreadSort([a, b, c], 'created');
    expect(out.map(t => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts alphabetically by title for "title"', () => {
    const out = applyThreadSort([a, b, c], 'title');
    expect(out.map(t => t.title)).toEqual(['Anna', 'Bjorn', 'Carl']);
  });

  it('does not mutate the input array', () => {
    const input = [a, b, c];
    const snapshot = input.slice();
    applyThreadSort(input, 'title');
    expect(input).toEqual(snapshot);
  });
});

// Search behavior moved server-side; see threads-queries.test.ts in
// packages/research for the case-insensitive title LIKE coverage.
