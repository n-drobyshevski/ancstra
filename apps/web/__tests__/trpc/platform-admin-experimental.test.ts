import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

const createCaller = createCallerFactory(appRouter);

function adminCtx(db: TestCentralDb, userId = 'admin1'): BaseContext {
  return {
    session: {
      user: { id: userId, email: 'admin@example.com', isPlatformAdmin: true },
    } as never,
    userId,
    familyId: null,
    role: null,
    actualRole: null,
    dbFilename: null,
    familyDb: null,
    centralDb: db as never,
  };
}

function nonAdminCtx(db: TestCentralDb, userId = 'u1'): BaseContext {
  return {
    session: {
      user: { id: userId, email: 'u@example.com', isPlatformAdmin: false },
    } as never,
    userId,
    familyId: null,
    role: null,
    actualRole: null,
    dbFilename: null,
    familyDb: null,
    centralDb: db as never,
  };
}

async function seedAdmin(db: TestCentralDb, id: string, name: string) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values({
    id,
    email: `${id}@example.com`,
    name,
    isPlatformAdmin: 1,
    createdAt: now,
    updatedAt: now,
  }).run();
}

describe('platformAdmin.getExperimentalPolicy', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedAdmin(db, 'admin1', 'Admin One');
  });

  it('returns the seeded singleton (allowUsers=false by default)', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.getExperimentalPolicy();
    expect(result.allowUsers).toBe(false);
    expect(result.updatedBy).toBeNull();
  });

  it('reflects an updated value', async () => {
    await db.update(centralSchema.platformSettings)
      .set({ experimentalFeaturesAllowUsers: 1 })
      .where(eq(centralSchema.platformSettings.id, 'global'))
      .run();

    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.getExperimentalPolicy();
    expect(result.allowUsers).toBe(true);
  });

  it('rejects non-admin callers (NOT_FOUND, not FORBIDDEN — matches page-level guard)', async () => {
    const caller = createCaller(nonAdminCtx(db));
    await expect(caller.platformAdmin.getExperimentalPolicy()).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('platformAdmin.updateExperimentalPolicy', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedAdmin(db, 'admin1', 'Admin One');
  });

  it('flips the flag and records updatedBy', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.updateExperimentalPolicy({ allowUsers: true });
    expect(result).toEqual({ ok: true, changed: true });

    const row = await db.select().from(centralSchema.platformSettings)
      .where(eq(centralSchema.platformSettings.id, 'global')).get();
    expect(row?.experimentalFeaturesAllowUsers).toBe(1);
    expect(row?.updatedBy).toBe('admin1');
  });

  it('writes a platform_audit_log entry with targetType=platform', async () => {
    const caller = createCaller(adminCtx(db));
    await caller.platformAdmin.updateExperimentalPolicy({ allowUsers: true });

    const log = await db.select().from(centralSchema.platformAuditLog).all();
    expect(log).toHaveLength(1);
    expect(log[0].action).toBe('platform.experimental.policy.update');
    expect(log[0].targetType).toBe('platform');
    expect(log[0].targetId).toBe('global');
    expect(log[0].actorUserId).toBe('admin1');
    const metadata = JSON.parse(log[0].metadata ?? '{}');
    expect(metadata).toEqual({ previous: false, next: true });
  });

  it('is a no-op when value is unchanged (no audit row, returns changed=false)', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.updateExperimentalPolicy({ allowUsers: false });
    expect(result).toEqual({ ok: true, changed: false });

    const log = await db.select().from(centralSchema.platformAuditLog).all();
    expect(log).toHaveLength(0);
  });

  it('rejects non-admin callers', async () => {
    const caller = createCaller(nonAdminCtx(db));
    await expect(
      caller.platformAdmin.updateExperimentalPolicy({ allowUsers: true }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('toggle ON then OFF produces two audit rows with correct previous/next', async () => {
    const caller = createCaller(adminCtx(db));
    await caller.platformAdmin.updateExperimentalPolicy({ allowUsers: true });
    await caller.platformAdmin.updateExperimentalPolicy({ allowUsers: false });

    const log = await db.select().from(centralSchema.platformAuditLog).all();
    expect(log).toHaveLength(2);
    const meta1 = JSON.parse(log[0].metadata ?? '{}');
    const meta2 = JSON.parse(log[1].metadata ?? '{}');
    expect(meta1).toEqual({ previous: false, next: true });
    expect(meta2).toEqual({ previous: true, next: false });
  });
});
