import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
import { eq } from 'drizzle-orm';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('next/cache', () => ({
  updateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    ensureFamilySchema: vi.fn(async () => undefined),
  };
});

const createCaller = createCallerFactory(appRouter);

function makeCtx(db: TestCentralDb, userId = 'u-alice'): BaseContext {
  return {
    session: { user: { id: userId } } as never,
    userId,
    familyId: null,
    role: null,
    actualRole: null,
    dbFilename: null,
    familyDb: null,
    centralDb: db as never,
  };
}

async function seedUsers(db: TestCentralDb) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values([
    { id: 'u-alice', email: 'a@x.com', name: 'Alice', createdAt: now, updatedAt: now },
    { id: 'u-bob',   email: 'b@x.com', name: 'Bob',   createdAt: now, updatedAt: now },
  ]).run();
}

describe('userPreferences.get', () => {
  let db: TestCentralDb;
  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUsers(db);
  });

  it('returns built-in defaults on first read (no row yet)', async () => {
    const caller = createCaller(makeCtx(db, 'u-alice'));
    const prefs = await caller.userPreferences.get();

    expect(prefs).toEqual({
      locale: 'en-US',
      timezone: 'UTC',
      density: 'comfortable',
      notifyEmail: true,
      notifyActivity: true,
      treeAutoSpread: true,
      treeGenealogicalOrdering: true,
    });
  });

  it('returns persisted values when a row exists', async () => {
    const now = new Date().toISOString();
    await db.insert(centralSchema.userPreferences).values({
      userId: 'u-alice',
      locale: 'de-DE',
      timezone: 'Europe/Berlin',
      density: 'compact',
      notifyEmail: 0,
      notifyActivity: 1,
      updatedAt: now,
    }).run();

    const caller = createCaller(makeCtx(db, 'u-alice'));
    const prefs = await caller.userPreferences.get();

    expect(prefs).toEqual({
      locale: 'de-DE',
      timezone: 'Europe/Berlin',
      density: 'compact',
      notifyEmail: false,
      notifyActivity: true,
      treeAutoSpread: true,
      treeGenealogicalOrdering: true,
    });
  });

  it('rejects unauthenticated callers', async () => {
    const caller = createCaller({ ...makeCtx(db), session: null, userId: null });
    await expect(caller.userPreferences.get()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('userPreferences.update', () => {
  let db: TestCentralDb;
  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUsers(db);
  });

  it('inserts a row with the provided values on first update', async () => {
    const caller = createCaller(makeCtx(db, 'u-alice'));
    await caller.userPreferences.update({ timezone: 'America/Los_Angeles', density: 'compact' });

    const row = await db.select().from(centralSchema.userPreferences)
      .where(eq(centralSchema.userPreferences.userId, 'u-alice')).get();
    expect(row).toBeDefined();
    expect(row?.timezone).toBe('America/Los_Angeles');
    expect(row?.density).toBe('compact');
    expect(row?.locale).toBe('en-US');
  });

  it('partial update preserves untouched fields', async () => {
    const caller = createCaller(makeCtx(db, 'u-alice'));
    await caller.userPreferences.update({ locale: 'fr-FR', timezone: 'Europe/Paris' });
    await caller.userPreferences.update({ density: 'compact' });

    const row = await db.select().from(centralSchema.userPreferences)
      .where(eq(centralSchema.userPreferences.userId, 'u-alice')).get();
    expect(row?.locale).toBe('fr-FR');
    expect(row?.timezone).toBe('Europe/Paris');
    expect(row?.density).toBe('compact');
  });

  it('returns the resolved preferences after update', async () => {
    const caller = createCaller(makeCtx(db, 'u-alice'));
    const result = await caller.userPreferences.update({ notifyEmail: false });
    expect(result).toEqual({
      locale: 'en-US',
      timezone: 'UTC',
      density: 'comfortable',
      notifyEmail: false,
      notifyActivity: true,
      treeAutoSpread: true,
      treeGenealogicalOrdering: true,
    });
  });

  it('user A cannot affect user B preferences', async () => {
    const aliceCaller = createCaller(makeCtx(db, 'u-alice'));
    await aliceCaller.userPreferences.update({ locale: 'de-DE' });

    const bobRow = await db.select().from(centralSchema.userPreferences)
      .where(eq(centralSchema.userPreferences.userId, 'u-bob')).get();
    expect(bobRow).toBeUndefined();
  });

  it('rejects empty patch with BAD_REQUEST', async () => {
    const caller = createCaller(makeCtx(db, 'u-alice'));
    await expect(caller.userPreferences.update({})).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});

describe('userPreferences.updateProfile', () => {
  let db: TestCentralDb;
  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUsers(db);
  });

  it('updates the caller display name', async () => {
    const caller = createCaller(makeCtx(db, 'u-alice'));
    await caller.userPreferences.updateProfile({ name: 'Alice Renamed' });

    const row = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'u-alice')).get();
    expect(row?.name).toBe('Alice Renamed');
  });

  it('updates avatar url', async () => {
    const caller = createCaller(makeCtx(db, 'u-alice'));
    await caller.userPreferences.updateProfile({ avatarUrl: 'https://cdn/x.png' });

    const row = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'u-alice')).get();
    expect(row?.avatarUrl).toBe('https://cdn/x.png');
  });

  it('cannot modify another user (only the caller)', async () => {
    const caller = createCaller(makeCtx(db, 'u-alice'));
    await caller.userPreferences.updateProfile({ name: 'Alice Renamed' });

    const bob = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'u-bob')).get();
    expect(bob?.name).toBe('Bob');
  });

  it('rejects empty patch with BAD_REQUEST', async () => {
    const caller = createCaller(makeCtx(db, 'u-alice'));
    await expect(caller.userPreferences.updateProfile({})).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects empty/whitespace name', async () => {
    const caller = createCaller(makeCtx(db, 'u-alice'));
    await expect(
      caller.userPreferences.updateProfile({ name: '   ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
