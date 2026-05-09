import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
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

async function seedUser(db: TestCentralDb, id: string) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values({
    id,
    email: `${id}@x.com`,
    name: id,
    createdAt: now,
    updatedAt: now,
  }).run();
}

async function setPolicy(db: TestCentralDb, allowUsers: boolean) {
  await db.update(centralSchema.platformSettings)
    .set({ experimentalFeaturesAllowUsers: allowUsers ? 1 : 0 })
    .where(eq(centralSchema.platformSettings.id, 'global'))
    .run();
}

describe('experimental.getMyState', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUser(db, 'u-alice');
  });

  it('returns all-off when no prefs row and policy off', async () => {
    await setPolicy(db, false);
    const caller = createCaller(makeCtx(db));
    const state = await caller.experimental.getMyState();
    expect(state.policyAllowsUsers).toBe(false);
    expect(state.masterEnabled).toBe(false);
    expect(state.perFeature.biography).toBe(false);
  });

  it('returns all-on when policy on, master on, no overrides', async () => {
    await setPolicy(db, true);
    const caller = createCaller(makeCtx(db));
    await caller.experimental.setMine({ master: true });

    const state = await caller.experimental.getMyState();
    expect(state.policyAllowsUsers).toBe(true);
    expect(state.masterEnabled).toBe(true);
    expect(state.perFeature).toEqual({
      biography: true,
      researchChat: true,
      historicalContext: true,
    });
  });

  it('rejects unauthenticated callers', async () => {
    const caller = createCaller({ ...makeCtx(db), session: null, userId: null });
    await expect(caller.experimental.getMyState()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('experimental.setMine', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedUser(db, 'u-alice');
    await seedUser(db, 'u-bob');
    await setPolicy(db, true);
  });

  it('upserts master switch on first call (no row yet)', async () => {
    const caller = createCaller(makeCtx(db));
    const result = await caller.experimental.setMine({ master: true });

    expect(result.masterEnabled).toBe(true);
    const row = await db.select().from(centralSchema.userPreferences)
      .where(eq(centralSchema.userPreferences.userId, 'u-alice')).get();
    expect(row?.experimentalEnabled).toBe(1);
    expect(row?.experimentalFeatures).toBe('{}');
  });

  it('toggling master without overrides preserves existing overrides', async () => {
    const caller = createCaller(makeCtx(db));
    await caller.experimental.setMine({ master: true, overrides: { biography: false } });
    await caller.experimental.setMine({ master: false });

    const row = await db.select().from(centralSchema.userPreferences)
      .where(eq(centralSchema.userPreferences.userId, 'u-alice')).get();
    expect(row?.experimentalEnabled).toBe(0);
    expect(JSON.parse(row?.experimentalFeatures ?? '{}')).toEqual({ biography: false });
  });

  it('overrides patch merges with existing', async () => {
    const caller = createCaller(makeCtx(db));
    await caller.experimental.setMine({ master: true, overrides: { biography: false } });
    await caller.experimental.setMine({ overrides: { researchChat: false } });

    const row = await db.select().from(centralSchema.userPreferences)
      .where(eq(centralSchema.userPreferences.userId, 'u-alice')).get();
    expect(JSON.parse(row?.experimentalFeatures ?? '{}')).toEqual({
      biography: false,
      researchChat: false,
    });
  });

  it('null override removes the key from the JSON', async () => {
    const caller = createCaller(makeCtx(db));
    await caller.experimental.setMine({ master: true, overrides: { biography: false, researchChat: false } });
    await caller.experimental.setMine({ overrides: { biography: null } });

    const row = await db.select().from(centralSchema.userPreferences)
      .where(eq(centralSchema.userPreferences.userId, 'u-alice')).get();
    expect(JSON.parse(row?.experimentalFeatures ?? '{}')).toEqual({
      researchChat: false,
    });
  });

  it('returns the freshly-resolved state, including the policy gate', async () => {
    await setPolicy(db, false);
    const caller = createCaller(makeCtx(db));
    const result = await caller.experimental.setMine({ master: true });

    expect(result.masterEnabled).toBe(true);
    expect(result.policyAllowsUsers).toBe(false);
    // Per-feature is gated off by policy regardless of master/overrides
    expect(result.perFeature.biography).toBe(false);
  });

  it('user A cannot affect user B prefs', async () => {
    const aliceCaller = createCaller(makeCtx(db, 'u-alice'));
    await aliceCaller.experimental.setMine({ master: true });

    const bob = await db.select().from(centralSchema.userPreferences)
      .where(eq(centralSchema.userPreferences.userId, 'u-bob')).get();
    expect(bob).toBeUndefined();
  });

  it('rejects empty patch (no master, no overrides)', async () => {
    const caller = createCaller(makeCtx(db));
    await expect(caller.experimental.setMine({})).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
