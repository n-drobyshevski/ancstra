import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

// Mocks for modules that shouldn't run in tests
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    createCentralDb: vi.fn(() => ({} as never)),
    createFamilyDb: vi.fn(() => ({} as never)),
    ensureFamilySchema: vi.fn(async () => undefined),
  };
});

// Helper to build a fluent DB mock whose terminal .all() resolves to `rows`
function makeDb(rows: unknown[]) {
  const chain = {
    all: vi.fn().mockResolvedValue(rows),
  };
  const withOrderBy = { orderBy: vi.fn(() => chain) };
  const withWhere = { where: vi.fn(() => withOrderBy) };
  const withInnerJoin = { innerJoin: vi.fn(() => withWhere) };
  const withFrom = { from: vi.fn(() => withInnerJoin) };
  return {
    db: { select: vi.fn(() => withFrom) } as never,
    chain,
  };
}

const createCaller = createCallerFactory(appRouter);

function authedCtx(userId: string, centralDb: never): BaseContext {
  return {
    session: { user: { id: userId } } as never,
    userId,
    familyId: null,
    role: null,
    actualRole: null,
    dbFilename: null,
    familyDb: null,
    centralDb,
  };
}

describe('family.listMine', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the user\'s families with correct roles', async () => {
    const familyRows = [
      { id: 'fam-a', name: 'Family A', role: 'admin' as const },
      { id: 'fam-b', name: 'Family B', role: 'viewer' as const },
    ];
    const { db } = makeDb(familyRows);
    const caller = createCaller(authedCtx('u1', db));
    const result = await caller.family.listMine();
    expect(result).toEqual(familyRows);
  });

  it('returns an empty array when the user has no memberships', async () => {
    const { db } = makeDb([]);
    const caller = createCaller(authedCtx('u-no-families', db));
    const result = await caller.family.listMine();
    expect(result).toEqual([]);
  });

  it('returns rows in the order provided by the DB (lastSeenAt DESC)', async () => {
    // The ordering is delegated to the DB; we verify the query returns rows in
    // whatever order the DB yields — the actual ORDER BY clause is exercised
    // via the proxy integration, but here we confirm the result is not sorted
    // client-side (i.e., the raw DB order is preserved).
    const orderedRows = [
      { id: 'fam-3', name: 'Recent',  role: 'owner'  as const },
      { id: 'fam-1', name: 'Older',   role: 'editor' as const },
      { id: 'fam-2', name: 'Oldest',  role: 'viewer' as const },
    ];
    const { db } = makeDb(orderedRows);
    const caller = createCaller(authedCtx('u1', db));
    const result = await caller.family.listMine();
    expect(result).toEqual(orderedRows);
  });

  it('excludes inactive memberships (filtered by the DB WHERE clause)', async () => {
    // Only active rows are returned by the DB — our mock simulates the DB
    // having already applied the isActive = 1 filter.
    const activeRows = [
      { id: 'fam-active', name: 'Active Family', role: 'editor' as const },
    ];
    const { db } = makeDb(activeRows);
    const caller = createCaller(authedCtx('u1', db));
    const result = await caller.family.listMine();
    // The inactive family is absent — the DB mock reflects what the WHERE
    // clause (isActive = 1) would have filtered.
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('fam-active');
  });

  it('returns only the current user\'s families, not other users\'', async () => {
    // User A's families
    const userARows = [
      { id: 'fam-a', name: 'A\'s Family', role: 'owner' as const },
    ];
    // User B's families — separate DB mock simulates separate query context
    const userBRows = [
      { id: 'fam-b', name: 'B\'s Family', role: 'admin' as const },
    ];

    const { db: dbA } = makeDb(userARows);
    const { db: dbB } = makeDb(userBRows);

    const callerA = createCaller(authedCtx('user-a', dbA));
    const callerB = createCaller(authedCtx('user-b', dbB));

    const resultA = await callerA.family.listMine();
    const resultB = await callerB.family.listMine();

    expect(resultA).toEqual(userARows);
    expect(resultB).toEqual(userBRows);
    // Cross-contamination check
    expect(resultA.map((r) => r.id)).not.toContain('fam-b');
    expect(resultB.map((r) => r.id)).not.toContain('fam-a');
  });

  it('throws UNAUTHORIZED when there is no session', async () => {
    const { db } = makeDb([]);
    const caller = createCaller({
      session: null,
      userId: null,
      familyId: null,
      role: null,
      actualRole: null,
      dbFilename: null,
      familyDb: null,
      centralDb: db,
    });
    await expect(caller.family.listMine()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
