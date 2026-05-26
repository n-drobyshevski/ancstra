import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for getCachedPersonSearchAttemptCount (Bundle E §4.4).
 *
 * The function uses 'use cache' + cacheTag — Next.js compiles those to no-ops
 * in the test runtime, so we mock 'next/cache' and the DB shims directly.
 */

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

// --- DB shim ------------------------------------------------------------

let stubbedRows: Array<{ count: number }> = [];

const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        all: async () => stubbedRows,
      }),
    }),
  }),
};

vi.mock('@/lib/db', () => ({
  getFamilyDb: async () => mockDb,
}));

vi.mock('@ancstra/db', () => ({
  searchAttempts: { personId: 'personId_col' },
  eq: vi.fn(),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(''),
    { raw: (s: string) => s },
  ),
}));

// --- Tests ---------------------------------------------------------------

import { getCachedPersonSearchAttemptCount } from '@/lib/cache/search-attempts';

describe('getCachedPersonSearchAttemptCount', () => {
  beforeEach(() => {
    stubbedRows = [];
  });

  it('returns the count from the DB', async () => {
    stubbedRows = [{ count: 7 }];
    const result = await getCachedPersonSearchAttemptCount('test.db', 'person-1');
    expect(result).toBe(7);
  });

  it('returns 0 when no attempts exist', async () => {
    stubbedRows = [{ count: 0 }];
    const result = await getCachedPersonSearchAttemptCount('test.db', 'person-2');
    expect(result).toBe(0);
  });

  it('returns 0 when DB returns empty array (null-coalesce guard)', async () => {
    stubbedRows = [];
    const result = await getCachedPersonSearchAttemptCount('test.db', 'person-3');
    expect(result).toBe(0);
  });
});
