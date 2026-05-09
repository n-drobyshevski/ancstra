import { describe, it, expect, vi, beforeEach } from 'vitest';

// `'use cache'` directives compile to no-ops; bare imports must still resolve.
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

// Each helper has its own chained-builder shape — capture the queued result
// per "table call" so different tests can return different data.
type StatusRow = { status: string; count: number };
type FactsheetRow = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  createdBy?: string;
};

const myStatusRows: StatusRow[] = [];
let aiSuggestionCount = 0;
let lastFactsheetRow: FactsheetRow | null = null;
const recentFactsheetRows: FactsheetRow[] = [];

// One in-memory Drizzle-shaped shim. The tests pin a `lastFromTable` flag
// from the .from() call so different chains route to the right canned data.
let lastFromTable: 'pendingContributions' | 'researchItems' | 'factsheetsLast' | 'factsheetsRecent' | null = null;

const mockDb = {
  select: () => ({
    from: (table: unknown) => {
      const t = table as { _: { name?: string } } | { Symbol?: unknown };
      // Best-effort detection by the schema object identity passed in.
      // Tests set `lastFromTable` explicitly via setMode() to disambiguate.
      void t;
      return {
        where: () => ({
          groupBy: () => ({
            all: async () => myStatusRows.slice(),
          }),
          all: async () => {
            if (lastFromTable === 'researchItems') {
              return [{ count: aiSuggestionCount }];
            }
            return myStatusRows.slice();
          },
          orderBy: () => ({
            limit: () => ({
              get: async () => lastFactsheetRow,
              all: async () => recentFactsheetRows.slice(),
            }),
          }),
        }),
        orderBy: () => ({
          limit: () => ({
            all: async () => recentFactsheetRows.slice(),
            get: async () => lastFactsheetRow,
          }),
        }),
      };
    },
  }),
} as const;

vi.mock('@/lib/db', () => ({
  getFamilyDb: () => Promise.resolve(mockDb),
}));

// Drizzle schema modules are imported by the cache helper — return harmless stubs.
vi.mock('@ancstra/db', () => ({
  pendingContributions: { _: { name: 'pending_contributions' } },
  factsheets: { _: { name: 'factsheets' } },
  researchItems: { _: { name: 'research_items' } },
}));

import {
  getCachedMyContributionsStatus,
  getCachedAiSuggestionsCount,
  getCachedLastFactsheetForUser,
  getCachedRecentFactsheets,
} from '@/lib/cache/dashboard-editor';

function setMode(mode: typeof lastFromTable) {
  lastFromTable = mode;
}

describe('getCachedMyContributionsStatus', () => {
  beforeEach(() => {
    myStatusRows.length = 0;
    setMode('pendingContributions');
  });

  it('aggregates per-status counts, total = sum of all', async () => {
    myStatusRows.push(
      { status: 'pending', count: 2 },
      { status: 'approved', count: 5 },
      { status: 'revision_requested', count: 1 },
      { status: 'rejected', count: 3 },
    );
    const result = await getCachedMyContributionsStatus('fam.db', 'u1');
    expect(result).toEqual({
      pending: 2,
      approved: 5,
      revisionRequested: 1,
      rejected: 3,
      total: 11,
    });
  });

  it('returns all-zero when user has no contributions', async () => {
    const result = await getCachedMyContributionsStatus('fam.db', 'u1');
    expect(result).toEqual({
      pending: 0,
      approved: 0,
      rejected: 0,
      revisionRequested: 0,
      total: 0,
    });
  });

  it('zero-fills missing buckets when only some statuses present', async () => {
    myStatusRows.push({ status: 'approved', count: 4 });
    const result = await getCachedMyContributionsStatus('fam.db', 'u1');
    expect(result.approved).toBe(4);
    expect(result.pending).toBe(0);
    expect(result.rejected).toBe(0);
    expect(result.revisionRequested).toBe(0);
    expect(result.total).toBe(4);
  });

  it('ignores unknown status values gracefully (forward-compat)', async () => {
    myStatusRows.push(
      { status: 'pending', count: 1 },
      { status: 'archived_future_state', count: 9 },
    );
    const result = await getCachedMyContributionsStatus('fam.db', 'u1');
    expect(result.pending).toBe(1);
    // Unknown bucket goes to total but not into any named field.
    expect(result.total).toBe(10);
  });
});

describe('getCachedAiSuggestionsCount', () => {
  beforeEach(() => {
    aiSuggestionCount = 0;
    setMode('researchItems');
  });

  it('returns the count from the query', async () => {
    aiSuggestionCount = 7;
    const result = await getCachedAiSuggestionsCount('fam.db');
    expect(result).toBe(7);
  });

  it('returns 0 when there are no rows', async () => {
    aiSuggestionCount = 0;
    const result = await getCachedAiSuggestionsCount('fam.db');
    expect(result).toBe(0);
  });
});

describe('getCachedLastFactsheetForUser', () => {
  beforeEach(() => {
    lastFactsheetRow = null;
    setMode('factsheetsLast');
  });

  it('returns null when the user has no factsheets', async () => {
    const result = await getCachedLastFactsheetForUser('fam.db', 'u1');
    expect(result).toBeNull();
  });

  it('returns the row shape expected by the hero', async () => {
    lastFactsheetRow = {
      id: 'fs-1',
      title: 'Maria Sokolova (1832–?)',
      status: 'draft',
      updatedAt: '2026-05-09T08:00:00.000Z',
    };
    const result = await getCachedLastFactsheetForUser('fam.db', 'u1');
    expect(result).toEqual(lastFactsheetRow);
  });
});

describe('getCachedRecentFactsheets', () => {
  beforeEach(() => {
    recentFactsheetRows.length = 0;
    setMode('factsheetsRecent');
  });

  it('returns at most `limit` rows in the order the DB returned them', async () => {
    recentFactsheetRows.push(
      { id: 'a', title: 'A', status: 'ready', updatedAt: '2026-05-09T10:00Z', createdBy: 'u1' },
      { id: 'b', title: 'B', status: 'draft', updatedAt: '2026-05-09T09:00Z', createdBy: 'u2' },
    );
    const result = await getCachedRecentFactsheets('fam.db', 5);
    expect(result.length).toBe(2);
    expect(result[0]?.id).toBe('a');
  });

  it('returns empty array when no factsheets', async () => {
    const result = await getCachedRecentFactsheets('fam.db', 5);
    expect(result).toEqual([]);
  });
});
