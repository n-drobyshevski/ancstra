import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

/**
 * Set-assembly coverage for `presumedLivingIds` in
 * `apps/web/server/api/routers/gedcom.ts:51-79`.
 *
 * The PREDICATE (`isPresumablyLiving`) is tested exhaustively in
 * `packages/auth/__tests__/privacy.test.ts`.
 * The TRPC wiring + threshold override is tested in
 * `apps/web/__tests__/trpc/gedcom-export-defaults.test.ts`.
 *
 * This file anchors the SET-ASSEMBLY edge cases those two miss:
 *   - a person with NO birth event in the events table → still presumed
 *     living (conservative default from the predicate's no-birth branch).
 *   - a person with both a birth event 30y ago AND a death event → NOT in
 *     the set (death short-circuits regardless of birth recency).
 *   - a person with isLiving=false but no death event in the events table →
 *     NOT in the set (the persons.isLiving column is authoritative).
 */

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    createCentralDb: vi.fn(() => ({}) as never),
    createFamilyDb: vi.fn(() => ({}) as never),
    ensureFamilySchema: vi.fn(async () => undefined),
  };
});

vi.mock('@ancstra/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/auth')>();
  return { ...original, logActivity: vi.fn(async () => undefined) };
});

const { serializeMock } = vi.hoisted(() => ({
  serializeMock: vi.fn<
    (
      data: import('@/lib/gedcom/serialize').GedcomExportData,
      mode: import('@/lib/gedcom/serialize').ExportMode,
    ) => string
  >(() => '0 HEAD\n0 TRLR\n'),
}));
vi.mock('@/lib/gedcom/serialize', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/gedcom/serialize')>();
  return { ...original, serializeToGedcom: serializeMock };
});

const NOW_YEAR = new Date().getFullYear();
const sortKey = (yearsAgo: number) => (NOW_YEAR - yearsAgo) * 10000 + 101;

// Test fixture covering the four invariants in the docstring above.
const PERSONS = [
  { id: 'recent',   givenName: 'Alice', surname: 'R', sex: 'F', isLiving: true },
  { id: 'ancient',  givenName: 'Bob',   surname: 'A', sex: 'M', isLiving: true },
  { id: 'no-event', givenName: 'Carol', surname: 'N', sex: 'F', isLiving: true },
  { id: 'with-death', givenName: 'Dan', surname: 'D', sex: 'M', isLiving: true },
  { id: 'flag-dead', givenName: 'Eve',  surname: 'F', sex: 'F', isLiving: false },
] as const;

const EVENTS = [
  { id: 'e-recent-b',   eventType: 'birth', personId: 'recent',     dateSort: sortKey(30) },
  { id: 'e-ancient-b',  eventType: 'birth', personId: 'ancient',    dateSort: sortKey(200) },
  { id: 'e-withd-b',    eventType: 'birth', personId: 'with-death', dateSort: sortKey(30) },
  { id: 'e-withd-d',    eventType: 'death', personId: 'with-death', dateSort: sortKey(5) },
  // Note: no events for 'no-event' or 'flag-dead'.
];

vi.mock('@/lib/queries', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/queries')>();
  return {
    ...original,
    getTreeData: vi.fn(async () => ({
      persons: PERSONS as never,
      families: [],
      childLinks: [],
    })),
  };
});

function ctx(livingThresholdYears: number): BaseContext {
  const familyDb = {
    select: () => ({
      from: () => ({
        all: vi.fn(async () => EVENTS),
      }),
    }),
  };
  const centralDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          get: vi.fn(async () => ({
            defaultGedcomExportMode: 'shareable',
            livingThresholdYears,
          })),
        }),
      }),
    }),
  };
  return {
    session: { user: { id: 'u1' } } as never,
    userId: 'u1',
    familyId: 'f1',
    role: 'owner',
    actualRole: 'owner',
    dbFilename: 'fake.db',
    familyDb: familyDb as never,
    centralDb: centralDb as never,
  };
}

const createCaller = createCallerFactory(appRouter);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('presumedLivingIds — set assembly edge cases', () => {
  it.each([
    // [personId, threshold=100, expectedInSet, why]
    ['recent', true, 'birth 30y ago < 100y threshold, isLiving=true'],
    ['ancient', false, 'birth 200y ago > 100y threshold'],
    ['no-event', true, 'no birth event in DB → conservative default (predicate returns true)'],
    ['with-death', false, 'death event short-circuits regardless of birth recency'],
    ['flag-dead', false, 'isLiving=false on persons row overrides absence of death event'],
  ] as const)('person %s is %s in set under default 100y threshold (reason: %s)',
    async (personId, expected, _reason) => {
      const caller = createCaller(ctx(100));
      await caller.gedcom.export({ mode: 'shareable' });
      const [data] = serializeMock.mock.calls[0]!;
      expect(data.presumedLivingIds, 'shareable mode must populate the set').toBeDefined();
      expect(data.presumedLivingIds!.has(personId)).toBe(expected);
    },
  );

  it('per-family threshold override flips the ancient person into the set when raised to 250y', async () => {
    const caller = createCaller(ctx(250));
    await caller.gedcom.export({ mode: 'shareable' });
    const [data] = serializeMock.mock.calls[0]!;
    expect(data.presumedLivingIds!.has('ancient')).toBe(true);
    // no-event person stays in (no threshold applies if no birth date)
    expect(data.presumedLivingIds!.has('no-event')).toBe(true);
    // with-death stays out (death short-circuits at any threshold)
    expect(data.presumedLivingIds!.has('with-death')).toBe(false);
  });
});
