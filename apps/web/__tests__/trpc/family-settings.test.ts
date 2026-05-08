import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
import { eq } from 'drizzle-orm';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';
import type { Role } from '@ancstra/auth';

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

function makeCtx(
  db: TestCentralDb,
  overrides: Partial<BaseContext> = {},
): BaseContext {
  const base = {
    session: { user: { id: overrides.userId ?? 'u-owner' } } as never,
    userId: overrides.userId ?? 'u-owner',
    familyId: 'f1',
    role: 'owner' as Role,
    dbFilename: 'fake.db',
    familyDb: {} as never,
    centralDb: db as never,
    ...overrides,
  };
  // Tests don't exercise the lens; mirror effective role into actualRole.
  return { ...base, actualRole: base.role };
}

async function seedFamily(db: TestCentralDb) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values([
    { id: 'u-owner', email: 'o@x.com', name: 'Owner',  createdAt: now, updatedAt: now },
    { id: 'u-admin', email: 'a@x.com', name: 'Admin',  createdAt: now, updatedAt: now },
    { id: 'u-editor', email: 'e@x.com', name: 'Editor', createdAt: now, updatedAt: now },
  ]).run();

  await db.insert(centralSchema.familyRegistry).values({
    id: 'f1',
    name: 'Test Family',
    ownerId: 'u-owner',
    dbFilename: 'fake.db',
    moderationEnabled: 0,
    maxMembers: 50,
    monthlyAiBudgetUsd: 10,
    createdAt: now,
    updatedAt: now,
  }).run();

  await db.insert(centralSchema.familyMembers).values([
    { id: 'm-owner',  familyId: 'f1', userId: 'u-owner',  role: 'owner',  joinedAt: now, isActive: 1 },
    { id: 'm-admin',  familyId: 'f1', userId: 'u-admin',  role: 'admin',  joinedAt: now, isActive: 1 },
    { id: 'm-editor', familyId: 'f1', userId: 'u-editor', role: 'editor', joinedAt: now, isActive: 1 },
  ]).run();
}

describe('family.getSettings', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedFamily(db);
  });

  it('owner can read settings', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-owner', role: 'owner' }));
    const settings = await caller.family.getSettings();
    expect(settings.name).toBe('Test Family');
    expect(settings.ownerId).toBe('u-owner');
    expect(settings.moderationEnabled).toBe(false);
    expect(settings.maxMembers).toBe(50);
  });

  it('admin can read settings', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-admin', role: 'admin' }));
    const settings = await caller.family.getSettings();
    expect(settings.name).toBe('Test Family');
  });

  it('editor cannot read settings (FORBIDDEN — needs members:manage)', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-editor', role: 'editor' }));
    await expect(caller.family.getSettings()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('family.updateSettings', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedFamily(db);
  });

  it('owner updates name and writes activity_feed entry', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-owner', role: 'owner' }));
    const result = await caller.family.updateSettings({ name: 'Renamed Family' });
    expect(result.changed).toEqual(['name']);
    expect(result.row.name).toBe('Renamed Family');

    const feed = await db.select().from(centralSchema.activityFeed)
      .where(eq(centralSchema.activityFeed.familyId, 'f1')).all();
    expect(feed).toHaveLength(1);
    expect(feed[0].action).toBe('family_settings_updated');
    expect(feed[0].userId).toBe('u-owner');
    expect(feed[0].summary).toBe('Updated family name');
  });

  it('owner updates multiple fields with combined summary', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-owner', role: 'owner' }));
    const result = await caller.family.updateSettings({
      maxMembers: 100,
      monthlyAiBudgetUsd: 25,
    });
    expect(result.changed.sort()).toEqual(['maxMembers', 'monthlyAiBudgetUsd']);

    const feed = await db.select().from(centralSchema.activityFeed)
      .where(eq(centralSchema.activityFeed.familyId, 'f1')).all();
    expect(feed[0].summary).toMatch(/member limit/);
    expect(feed[0].summary).toMatch(/AI budget/);
  });

  it('no-op patch does not write activity_feed', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-owner', role: 'owner' }));
    const result = await caller.family.updateSettings({ name: 'Test Family' });
    expect(result.changed).toEqual([]);

    const feed = await db.select().from(centralSchema.activityFeed)
      .where(eq(centralSchema.activityFeed.familyId, 'f1')).all();
    expect(feed).toHaveLength(0);
  });

  it('admin cannot update settings (FORBIDDEN — owner-only)', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-admin', role: 'admin' }));
    await expect(
      caller.family.updateSettings({ name: 'Hijacked' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects empty name', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-owner', role: 'owner' }));
    await expect(
      caller.family.updateSettings({ name: '   ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('family.delete', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedFamily(db);
  });

  it('owner deletes with matching confirmation', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-owner', role: 'owner' }));
    const result = await caller.family.delete({ confirmName: 'Test Family' });
    expect(result.deleted).toBe(true);

    const stillThere = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, 'f1')).get();
    expect(stillThere).toBeUndefined();
  });

  it('owner with mismatched confirmation gets BAD_REQUEST', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-owner', role: 'owner' }));
    await expect(
      caller.family.delete({ confirmName: 'Wrong' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const stillThere = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, 'f1')).get();
    expect(stillThere).toBeDefined();
  });

  it('admin cannot delete (FORBIDDEN — settings:manage gate)', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-admin', role: 'admin' }));
    await expect(
      caller.family.delete({ confirmName: 'Test Family' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
