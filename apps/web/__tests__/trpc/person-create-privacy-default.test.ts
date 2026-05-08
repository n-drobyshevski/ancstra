import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

const { insertSpy } = vi.hoisted(() => ({
  insertSpy: vi.fn<
    typeof import('@/server/api/routers/person/_logic').insertRelatedPerson
  >(async () => 'new-person-id'),
}));
vi.mock('@/server/api/routers/person/_logic', () => ({
  insertRelatedPerson: insertSpy,
}));

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

const createCaller = createCallerFactory(appRouter);

const minimalInput = {
  givenName: 'Jane',
  surname: 'Doe',
  sex: 'F' as const,
  isLiving: true,
};

async function seed(db: TestCentralDb, defaultPrivacyLevel: 'public' | 'private' | 'restricted') {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values({
    id: 'u1', email: 'a@x.com', name: 'A', createdAt: now, updatedAt: now,
  }).run();
  await db.insert(centralSchema.familyRegistry).values({
    id: 'f1', name: 'F', ownerId: 'u1', dbFilename: 'fake.db',
    defaultPrivacyLevel,
    createdAt: now, updatedAt: now,
  }).run();
  await db.insert(centralSchema.familyMembers).values({
    id: 'm1', familyId: 'f1', userId: 'u1', role: 'editor', joinedAt: now, isActive: 1,
  }).run();
}

function ctx(db: TestCentralDb): BaseContext {
  return {
    session: { user: { id: 'u1' } } as never,
    userId: 'u1',
    familyId: 'f1',
    role: 'editor',
    actualRole: 'editor',
    dbFilename: 'fake.db',
    familyDb: {} as never,
    centralDb: db as never,
  };
}

describe('person.createRelated wires family.defaultPrivacyLevel', () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes family's 'public' default to insertRelatedPerson", async () => {
    const db = createTestCentralDb();
    await seed(db, 'public');
    const caller = createCaller(ctx(db));

    await caller.person.createRelated(minimalInput);

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const call = insertSpy.mock.calls[0]!;
    const privacyArg = call[4];
    expect(privacyArg).toBe('public');
  });

  it("passes family's 'restricted' default to insertRelatedPerson", async () => {
    const db = createTestCentralDb();
    await seed(db, 'restricted');
    const caller = createCaller(ctx(db));

    await caller.person.createRelated(minimalInput);

    const call = insertSpy.mock.calls[0]!;
    expect(call[4]).toBe('restricted');
  });

  it("falls back to 'private' when family row is somehow missing", async () => {
    // Empty central DB — no family row at all. The procedure should still
    // execute (familyDb resolution happens upstream) and pass 'private' as
    // the safest default.
    const db = createTestCentralDb();
    // Seed only the user; skip family registry. Procedure middleware would
    // normally reject this in production, but we go straight to the mocked
    // procedure body to test the fallback path.
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values({
      id: 'u1', email: 'a@x.com', name: 'A', createdAt: now, updatedAt: now,
    }).run();
    const caller = createCaller(ctx(db));

    await caller.person.createRelated(minimalInput);

    const call = insertSpy.mock.calls[0]!;
    expect(call[4]).toBe('private');
  });
});
