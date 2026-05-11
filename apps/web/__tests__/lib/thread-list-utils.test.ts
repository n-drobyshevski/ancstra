import { describe, it, expect } from 'vitest';
import { applyThreadSort, applyThreadSearch } from '@/lib/research/thread-list-utils';
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

describe('applyThreadSearch', () => {
  const items = [
    mk({ id: '1', title: 'Eleonora WWII trail', summary: 'Tracing Eleonora across the Eastern front, 1944-45' }),
    mk({ id: '2', title: 'Lindgren parish records', summary: 'Church books from 1830s Smaland' }),
    mk({ id: '3', title: 'Drobyshevskij DNA matches', summary: null }),
  ];

  it('returns the full list when query is empty', () => {
    expect(applyThreadSearch(items, '')).toEqual(items);
    expect(applyThreadSearch(items, '   ')).toEqual(items);
  });

  it('matches case-insensitively on title', () => {
    expect(applyThreadSearch(items, 'eleonora').map(t => t.id)).toEqual(['1']);
    expect(applyThreadSearch(items, 'DNA').map(t => t.id)).toEqual(['3']);
  });

  it('matches case-insensitively on summary', () => {
    expect(applyThreadSearch(items, 'smaland').map(t => t.id)).toEqual(['2']);
    expect(applyThreadSearch(items, 'eastern').map(t => t.id)).toEqual(['1']);
  });

  it('handles threads with null summary without throwing', () => {
    expect(() => applyThreadSearch(items, 'foo')).not.toThrow();
  });

  it('returns empty array when nothing matches', () => {
    expect(applyThreadSearch(items, 'unrelated')).toEqual([]);
  });
});
