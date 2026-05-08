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
  return { ...original, ensureFamilySchema: vi.fn(async () => undefined) };
});

const createCaller = createCallerFactory(appRouter);

function makeCtx(db: TestCentralDb, overrides: Partial<BaseContext> = {}): BaseContext {
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
  return { ...base, actualRole: base.role };
}

async function seedFamily(db: TestCentralDb) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values([
    { id: 'u-owner',  email: 'o@x.com', name: 'Owner',  createdAt: now, updatedAt: now },
    { id: 'u-admin',  email: 'a@x.com', name: 'Admin',  createdAt: now, updatedAt: now },
    { id: 'u-editor', email: 'e@x.com', name: 'Editor', createdAt: now, updatedAt: now },
    { id: 'u-viewer', email: 'v@x.com', name: 'Viewer', createdAt: now, updatedAt: now },
  ]).run();
  await db.insert(centralSchema.familyRegistry).values({
    id: 'f1', name: 'Test Family', ownerId: 'u-owner', dbFilename: 'fake.db',
    createdAt: now, updatedAt: now,
  }).run();
  await db.insert(centralSchema.familyMembers).values([
    { id: 'm-o', familyId: 'f1', userId: 'u-owner',  role: 'owner',  joinedAt: now, isActive: 1 },
    { id: 'm-a', familyId: 'f1', userId: 'u-admin',  role: 'admin',  joinedAt: now, isActive: 1 },
    { id: 'm-e', familyId: 'f1', userId: 'u-editor', role: 'editor', joinedAt: now, isActive: 1 },
    { id: 'm-v', familyId: 'f1', userId: 'u-viewer', role: 'viewer', joinedAt: now, isActive: 1 },
  ]).run();
}

describe('family.getSettings includes editor defaults', () => {
  let db: TestCentralDb;
  beforeEach(async () => {
    db = createTestCentralDb();
    await seedFamily(db);
  });

  it('returns built-in defaults for a fresh family', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-owner', role: 'owner' }));
    const settings = await caller.family.getSettings();
    expect(settings.defaultPrivacyLevel).toBe('private');
    expect(settings.defaultGedcomExportMode).toBe('shareable');
    expect(settings.defaultCitationStyle).toBe('evidence-explained');
  });
});

describe('family.updateEditorDefaults', () => {
  let db: TestCentralDb;
  beforeEach(async () => {
    db = createTestCentralDb();
    await seedFamily(db);
  });

  it('editor can update editor defaults', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-editor', role: 'editor' }));
    const result = await caller.family.updateEditorDefaults({
      defaultPrivacyLevel: 'public',
      defaultGedcomExportMode: 'full',
    });
    expect(result.changed.sort()).toEqual(['defaultGedcomExportMode', 'defaultPrivacyLevel']);
    expect(result.row.defaultPrivacyLevel).toBe('public');
    expect(result.row.defaultGedcomExportMode).toBe('full');

    // Verify persistence
    const row = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, 'f1')).get();
    expect(row?.defaultPrivacyLevel).toBe('public');
    expect(row?.defaultGedcomExportMode).toBe('full');
  });

  it('admin can update', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-admin', role: 'admin' }));
    const result = await caller.family.updateEditorDefaults({
      defaultCitationStyle: 'chicago',
    });
    expect(result.row.defaultCitationStyle).toBe('chicago');
  });

  it('owner can update', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-owner', role: 'owner' }));
    const result = await caller.family.updateEditorDefaults({
      defaultCitationStyle: 'apa',
    });
    expect(result.row.defaultCitationStyle).toBe('apa');
  });

  it('viewer cannot update (FORBIDDEN — needs person:create)', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-viewer', role: 'viewer' }));
    await expect(
      caller.family.updateEditorDefaults({ defaultPrivacyLevel: 'public' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects empty patch', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-editor', role: 'editor' }));
    await expect(caller.family.updateEditorDefaults({})).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('writes an activity_feed entry on change', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-editor', role: 'editor' }));
    await caller.family.updateEditorDefaults({ defaultPrivacyLevel: 'public' });

    const feed = await db.select().from(centralSchema.activityFeed)
      .where(eq(centralSchema.activityFeed.familyId, 'f1')).all();
    expect(feed).toHaveLength(1);
    expect(feed[0].action).toBe('family_editor_defaults_updated');
    expect(feed[0].userId).toBe('u-editor');
  });

  it('no-op patch (same values) does not write activity_feed', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-editor', role: 'editor' }));
    const result = await caller.family.updateEditorDefaults({
      defaultPrivacyLevel: 'private', // same as schema default
    });
    expect(result.changed).toEqual([]);

    const feed = await db.select().from(centralSchema.activityFeed)
      .where(eq(centralSchema.activityFeed.familyId, 'f1')).all();
    expect(feed).toHaveLength(0);
  });

  it('rejects invalid enum value via zod', async () => {
    const caller = createCaller(makeCtx(db, { userId: 'u-editor', role: 'editor' }));
    await expect(
      // @ts-expect-error — testing runtime rejection of bad enum value
      caller.family.updateEditorDefaults({ defaultPrivacyLevel: 'bogus' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
