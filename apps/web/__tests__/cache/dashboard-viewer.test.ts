import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

// In-memory queues + flags for the chained-builder shim. Different queries
// hit different terminator methods, so we route each test's expected payload
// through the right one.
type CountRow = { count: number };
type PersonRow = {
  id: string;
  givenName: string;
  surname: string;
  sex: 'M' | 'F' | 'U';
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
};

let deceasedCount = 0;
let allPersonsCount = 0;
let lastOffset: number | null = null;
let pickedPerson: PersonRow | null = null;

let personsAdded = 0;
let eventsAdded = 0;
let sourcesAdded = 0;
let lastTable: 'persons' | 'events' | 'sources' | null = null;

const mockDb = {
  select: () => ({
    from: (table: unknown) => {
      // We can't easily distinguish tables from our shim's stub schema, so
      // tests pin the expected table via setTable(). The featured-ancestor
      // flow doesn't need this — it's all `persons` joins.
      void table;
      return {
        where: () => ({
          all: async (): Promise<CountRow[]> => {
            // Used by *-count queries (deceased, all-persons, milestones).
            if (lastTable === 'persons') return [{ count: personsAdded || allPersonsCount || deceasedCount }];
            if (lastTable === 'events') return [{ count: eventsAdded }];
            if (lastTable === 'sources') return [{ count: sourcesAdded }];
            // Default: featured-ancestor count chain — caller queues the
            // correct value via deceasedCount/allPersonsCount.
            return [{ count: deceasedCount }];
          },
          groupBy: () => ({
            all: async () => [],
          }),
        }),
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: (n: number) => {
                  lastOffset = n;
                  return { get: async () => pickedPerson };
                },
              }),
            }),
          }),
        }),
      };
    },
  }),
};

vi.mock('@/lib/db', () => ({
  getFamilyDb: () => Promise.resolve(mockDb),
}));

vi.mock('@ancstra/db', () => ({
  persons: { _: { name: 'persons' } },
  personNames: { _: { name: 'person_names' } },
  events: { _: { name: 'events' } },
  sources: { _: { name: 'sources' } },
}));

import {
  getCachedFeaturedAncestor,
  getCachedWhatsNewMilestones,
} from '@/lib/cache/dashboard-viewer';

function setTable(t: typeof lastTable) {
  lastTable = t;
}

beforeEach(() => {
  deceasedCount = 0;
  allPersonsCount = 0;
  lastOffset = null;
  pickedPerson = null;
  personsAdded = 0;
  eventsAdded = 0;
  sourcesAdded = 0;
  lastTable = null;
});

describe('getCachedFeaturedAncestor', () => {
  it('returns null on an empty tree (no deceased AND no living)', async () => {
    deceasedCount = 0;
    allPersonsCount = 0;
    const result = await getCachedFeaturedAncestor('fam.db', 'fam-1', '2026-05-09');
    expect(result).toBeNull();
  });

  it('picks a deceased person when any exist', async () => {
    deceasedCount = 5;
    pickedPerson = {
      id: 'p1',
      givenName: 'Maria',
      surname: 'Sokolova',
      sex: 'F',
      birthDate: '1832',
      deathDate: '1895',
      birthPlace: 'Moscow',
    };
    const result = await getCachedFeaturedAncestor('fam.db', 'fam-1', '2026-05-09');
    expect(result).toEqual(pickedPerson);
  });

  it('uses a deterministic offset for the same (familyId, dateSeed)', async () => {
    deceasedCount = 100;
    pickedPerson = {
      id: 'pX',
      givenName: 'X',
      surname: 'Y',
      sex: 'U',
      birthDate: null,
      deathDate: null,
      birthPlace: null,
    };
    await getCachedFeaturedAncestor('fam.db', 'fam-1', '2026-05-09');
    const firstOffset = lastOffset;
    await getCachedFeaturedAncestor('fam.db', 'fam-1', '2026-05-09');
    expect(lastOffset).toBe(firstOffset);
    // And the offset is in [0, total).
    expect(firstOffset).toBeGreaterThanOrEqual(0);
    expect(firstOffset).toBeLessThan(100);
  });

  it('rotates offset when dateSeed changes', async () => {
    deceasedCount = 100;
    pickedPerson = {
      id: 'pX',
      givenName: 'X',
      surname: 'Y',
      sex: 'U',
      birthDate: null,
      deathDate: null,
      birthPlace: null,
    };
    await getCachedFeaturedAncestor('fam.db', 'fam-1', '2026-05-09');
    const day1 = lastOffset;
    await getCachedFeaturedAncestor('fam.db', 'fam-1', '2026-05-10');
    const day2 = lastOffset;
    // Different seeds should ~always pick different offsets when count is large.
    expect(day1).not.toBe(day2);
  });

  it('different families pick differently for the same date', async () => {
    deceasedCount = 100;
    pickedPerson = {
      id: 'pX',
      givenName: 'X',
      surname: 'Y',
      sex: 'U',
      birthDate: null,
      deathDate: null,
      birthPlace: null,
    };
    await getCachedFeaturedAncestor('fam.db', 'fam-A', '2026-05-09');
    const fA = lastOffset;
    await getCachedFeaturedAncestor('fam.db', 'fam-B', '2026-05-09');
    expect(lastOffset).not.toBe(fA);
  });
});

describe('getCachedWhatsNewMilestones', () => {
  it('returns isQuiet=true when nothing changed', async () => {
    setTable('persons');
    const result = await getCachedWhatsNewMilestones('fam.db');
    expect(result.isQuiet).toBe(true);
    expect(result.personsAdded).toBe(0);
    expect(result.eventsAdded).toBe(0);
    expect(result.sourcesAdded).toBe(0);
    expect(result.windowDays).toBe(7);
  });
});
