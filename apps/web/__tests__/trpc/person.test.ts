import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

vi.mock('@/server/api/routers/person/_logic', () => ({
  insertRelatedPerson: vi.fn(async () => 'new-person-id'),
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => null),
}));

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

vi.mock('@/lib/cache/person', () => ({
  getCachedPersonDetail: vi.fn(async () => ({
    id: 'p1',
    givenName: 'Alice',
    surname: 'Smith',
    sex: 'F',
    isLiving: false,
    privacyLevel: 'public',
    birthDate: null,
    deathDate: null,
    birthPlace: null,
    deathPlace: null,
    prefix: null,
    suffix: null,
    notes: null,
    createdAt: '2026-04-28T00:00:00Z',
    updatedAt: '2026-04-28T00:00:00Z',
    spouses: [],
    parents: [],
    children: [],
    siblings: [],
    events: [],
  })),
  getCachedCitationCount: vi.fn(async () => 3),
}));

const createCaller = createCallerFactory(appRouter);

function makeCtx(overrides: Partial<BaseContext> = {}): BaseContext {
  const base = {
    session: null,
    userId: null,
    familyId: null,
    role: null,
    dbFilename: null,
    familyDb: null,
    centralDb: {} as never,
    ...overrides,
  };
  // Tests don't exercise the lens; mirror effective role into actualRole.
  return { ...base, actualRole: base.role };
}

describe('person.fetchDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects no-session callers with UNAUTHORIZED', async () => {
    const caller = createCaller(makeCtx());
    await expect(caller.person.fetchDetail({ personId: 'p1' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects no-membership callers with FORBIDDEN', async () => {
    const caller = createCaller(
      makeCtx({
        session: { user: { id: 'u1' } } as never,
        userId: 'u1',
      }),
    );
    await expect(caller.person.fetchDetail({ personId: 'p1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('viewer can fetch detail (tree:view perm)', async () => {
    const caller = createCaller(
      makeCtx({
        session: { user: { id: 'u1' } } as never,
        userId: 'u1',
        familyId: 'f1',
        role: 'viewer',
        dbFilename: 'fake.db',
        familyDb: {} as never,
      }),
    );
    const result = await caller.person.fetchDetail({ personId: 'p1' });
    expect(result.detail).toBeDefined();
    expect(result.citationCount).toBe(3);
  });

  it('editor can fetch detail (tree:view perm)', async () => {
    const caller = createCaller(
      makeCtx({
        session: { user: { id: 'u1' } } as never,
        userId: 'u1',
        familyId: 'f1',
        role: 'editor',
        dbFilename: 'fake.db',
        familyDb: {} as never,
      }),
    );
    const result = await caller.person.fetchDetail({ personId: 'p1' });
    expect(result.detail).toBeDefined();
    expect(result.citationCount).toBe(3);
  });

  it('rejects empty personId with BAD_REQUEST', async () => {
    const caller = createCaller(
      makeCtx({
        session: { user: { id: 'u1' } } as never,
        userId: 'u1',
        familyId: 'f1',
        role: 'viewer',
        dbFilename: 'fake.db',
        familyDb: {} as never,
      }),
    );
    await expect(caller.person.fetchDetail({ personId: '' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});

const minimalPersonInput = {
  givenName: 'Jane',
  surname: 'Doe',
  sex: 'F' as const,
  isLiving: true,
};

describe('person.createRelated', () => {
  beforeEach(() => vi.clearAllMocks());

  it('viewer cannot create related person → FORBIDDEN', async () => {
    const caller = createCaller(
      makeCtx({
        session: { user: { id: 'u1' } } as never,
        userId: 'u1',
        familyId: 'f1',
        role: 'viewer',
        dbFilename: 'fake.db',
        familyDb: {} as never,
      }),
    );
    await expect(caller.person.createRelated(minimalPersonInput)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('editor can create related person → returns { personId }', async () => {
    const caller = createCaller(
      makeCtx({
        session: { user: { id: 'u1' } } as never,
        userId: 'u1',
        familyId: 'f1',
        role: 'editor',
        dbFilename: 'fake.db',
        familyDb: {} as never,
      }),
    );
    const result = await caller.person.createRelated(minimalPersonInput);
    expect(result).toEqual({ personId: 'new-person-id' });
  });
});
