import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    createCentralDb: vi.fn(() => ({} as never)),
    createFamilyDb: vi.fn(() => ({} as never)),
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

// Provide tree data with two persons: one living with recent birth, one
// living born 200 years ago. With threshold=100, only the recent one is
// presumed living. With threshold=250, both are.
vi.mock('@/lib/queries', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/queries')>();
  return {
    ...original,
    getTreeData: vi.fn(async () => ({
      persons: [
        { id: 'recent', givenName: 'Alice', surname: 'Recent', sex: 'F', isLiving: true } as never,
        { id: 'ancient', givenName: 'Bob', surname: 'Ancient', sex: 'M', isLiving: true } as never,
      ],
      families: [],
      childLinks: [],
    })),
  };
});

const createCaller = createCallerFactory(appRouter);

const NOW_YEAR = new Date().getFullYear();
const RECENT_BIRTH_SORT = (NOW_YEAR - 30) * 10000 + 101;
const ANCIENT_BIRTH_SORT = (NOW_YEAR - 200) * 10000 + 101;

interface FamilyRow {
  defaultGedcomExportMode: 'full' | 'shareable';
  livingThresholdYears: number;
}

function ctxWithFamily(familyRow: FamilyRow): BaseContext {
  // centralDb stub: select().from(familyRegistry).where(...).get() -> familyRow
  const centralDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          get: vi.fn(async () => familyRow),
        }),
      }),
    }),
  };
  // familyDb stub: select().from(events).all() returns birth events for both persons
  const familyDb = {
    select: () => ({
      from: () => ({
        all: vi.fn(async () => [
          { id: 'e1', eventType: 'birth', personId: 'recent',  dateSort: RECENT_BIRTH_SORT },
          { id: 'e2', eventType: 'birth', personId: 'ancient', dateSort: ANCIENT_BIRTH_SORT },
        ]),
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

describe('gedcom.export wires family defaults + livingThresholdYears', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses defaultGedcomExportMode when input.mode is omitted', async () => {
    const caller = createCaller(
      ctxWithFamily({ defaultGedcomExportMode: 'shareable', livingThresholdYears: 100 }),
    );
    await caller.gedcom.export(undefined);

    const [, modeArg] = serializeMock.mock.calls[0]!;
    expect(modeArg).toBe('shareable');
  });

  it('explicit input.mode wins over family default', async () => {
    const caller = createCaller(
      ctxWithFamily({ defaultGedcomExportMode: 'shareable', livingThresholdYears: 100 }),
    );
    await caller.gedcom.export({ mode: 'full' });

    const [, modeArg] = serializeMock.mock.calls[0]!;
    expect(modeArg).toBe('full');
  });

  it('shareable mode passes presumedLivingIds based on threshold (100yr)', async () => {
    const caller = createCaller(
      ctxWithFamily({ defaultGedcomExportMode: 'shareable', livingThresholdYears: 100 }),
    );
    await caller.gedcom.export({ mode: 'shareable' });

    const [data] = serializeMock.mock.calls[0]!;
    const ids = data.presumedLivingIds!;
    expect(ids.has('recent')).toBe(true);
    expect(ids.has('ancient')).toBe(false);
  });

  it('shareable mode threshold=250yr presumes both as living', async () => {
    const caller = createCaller(
      ctxWithFamily({ defaultGedcomExportMode: 'shareable', livingThresholdYears: 150 }),
    );
    await caller.gedcom.export({ mode: 'shareable' });
    // 150 is the max; ancient is 200 years old → still NOT presumed living
    const [data1] = serializeMock.mock.calls[0]!;
    expect(data1.presumedLivingIds!.has('recent')).toBe(true);
    expect(data1.presumedLivingIds!.has('ancient')).toBe(false);

    // Sanity: 250 isn't reachable via UI but the function accepts it directly
    serializeMock.mockClear();
    const caller2 = createCaller(
      ctxWithFamily({ defaultGedcomExportMode: 'shareable', livingThresholdYears: 250 }),
    );
    await caller2.gedcom.export({ mode: 'shareable' });
    const [data2] = serializeMock.mock.calls[0]!;
    expect(data2.presumedLivingIds!.has('recent')).toBe(true);
    expect(data2.presumedLivingIds!.has('ancient')).toBe(true);
  });

  it('full mode does not include presumedLivingIds (no redaction)', async () => {
    const caller = createCaller(
      ctxWithFamily({ defaultGedcomExportMode: 'shareable', livingThresholdYears: 100 }),
    );
    await caller.gedcom.export({ mode: 'full' });

    const [data, modeArg] = serializeMock.mock.calls[0]!;
    expect(modeArg).toBe('full');
    expect(data.presumedLivingIds).toBeUndefined();
  });
});
