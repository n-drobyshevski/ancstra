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

async function seedAuditEntry(
  db: TestCentralDb,
  id: string,
  opts: {
    actorUserId: string;
    action?: string;
    targetType?: 'user' | 'family';
    targetId?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  },
) {
  await db.insert(centralSchema.platformAuditLog).values({
    id,
    actorUserId: opts.actorUserId,
    action: opts.action ?? 'platform_admin.toggle',
    targetType: opts.targetType ?? 'user',
    targetId: opts.targetId ?? 'tgt1',
    summary: opts.summary ?? `Entry ${id}`,
    metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
    createdAt: opts.createdAt,
  }).run();
}

describe('platformAdmin.listAuditLog', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedAdmin(db, 'admin1', 'Admin One');
  });

  it('returns paginated entries for a platform admin', async () => {
    await seedAuditEntry(db, 'e1', { actorUserId: 'admin1', createdAt: '2026-01-01T00:00:00Z' });
    await seedAuditEntry(db, 'e2', { actorUserId: 'admin1', createdAt: '2026-01-02T00:00:00Z' });

    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.listAuditLog({ limit: 50 });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('e2');
    expect(result.nextCursor).toBeNull();
  });

  it('supports cursor pagination', async () => {
    await seedAuditEntry(db, 'e1', { actorUserId: 'admin1', createdAt: '2026-01-01T00:00:00Z' });
    await seedAuditEntry(db, 'e2', { actorUserId: 'admin1', createdAt: '2026-01-02T00:00:00Z' });
    await seedAuditEntry(db, 'e3', { actorUserId: 'admin1', createdAt: '2026-01-03T00:00:00Z' });

    const caller = createCaller(adminCtx(db));
    const page1 = await caller.platformAdmin.listAuditLog({ limit: 1 });
    expect(page1.items.map((i) => i.id)).toEqual(['e3']);
    expect(page1.nextCursor).toBe('e3');

    const page2 = await caller.platformAdmin.listAuditLog({ limit: 1, cursor: page1.nextCursor });
    expect(page2.items.map((i) => i.id)).toEqual(['e2']);
  });

  it('applies filters end-to-end', async () => {
    await seedAdmin(db, 'admin2', 'Admin Two');
    await seedAuditEntry(db, 'e1', { actorUserId: 'admin1', action: 'platform_admin.toggle', createdAt: '2026-01-01T00:00:00Z' });
    await seedAuditEntry(db, 'e2', { actorUserId: 'admin2', action: 'family.settings.update', createdAt: '2026-01-02T00:00:00Z' });

    const caller = createCaller(adminCtx(db));
    const filtered = await caller.platformAdmin.listAuditLog({
      action: 'family.settings.update',
    });
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].id).toBe('e2');
  });

  it('rejects callers without platform-admin status (NOT_FOUND)', async () => {
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values({
      id: 'u1', email: 'u1@example.com', name: 'User One', createdAt: now, updatedAt: now,
    }).run();

    const caller = createCaller(nonAdminCtx(db));
    await expect(caller.platformAdmin.listAuditLog({})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects unauthenticated callers (UNAUTHORIZED from session gate)', async () => {
    const caller = createCaller({
      session: null,
      userId: null,
      familyId: null,
      role: null,
      actualRole: null,
      dbFilename: null,
      familyDb: null,
      centralDb: db as never,
    });
    await expect(caller.platformAdmin.listAuditLog({})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('platformAdmin.updateFamilySettings', () => {
  let db: TestCentralDb;

  async function seedFamily(db: TestCentralDb, ownerId = 'u-owner') {
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values({
      id: ownerId, email: `${ownerId}@x.com`, name: 'Owner', createdAt: now, updatedAt: now,
    }).run();
    await db.insert(centralSchema.familyRegistry).values({
      id: 'f-target',
      name: 'Smith Family',
      ownerId,
      dbFilename: 'fake.db',
      moderationEnabled: 0,
      maxMembers: 50,
      monthlyAiBudgetUsd: 10,
      createdAt: now,
      updatedAt: now,
    }).run();
    await db.insert(centralSchema.familyMembers).values({
      id: 'm-1', familyId: 'f-target', userId: ownerId, role: 'owner',
      joinedAt: now, isActive: 1,
    }).run();
  }

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedAdmin(db, 'admin1', 'Admin One');
    await seedFamily(db);
  });

  it('platform admin updates family settings (cross-family override)', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.updateFamilySettings({
      familyId: 'f-target',
      name: 'Renamed by Admin',
      maxMembers: 100,
      moderationEnabled: true,
    });

    expect(result.changed.sort()).toEqual(['maxMembers', 'moderationEnabled', 'name']);
    expect(result.row.name).toBe('Renamed by Admin');
    expect(result.row.maxMembers).toBe(100);
    expect(result.row.moderationEnabled).toBe(true);
  });

  it('writes a platform_audit_log entry with before/after metadata', async () => {
    const caller = createCaller(adminCtx(db));
    await caller.platformAdmin.updateFamilySettings({
      familyId: 'f-target',
      name: 'Updated Name',
    });

    const audit = await db.select().from(centralSchema.platformAuditLog).all();
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('family.settings.update');
    expect(audit[0].targetType).toBe('family');
    expect(audit[0].targetId).toBe('f-target');
    expect(audit[0].summary).toMatch(/Smith Family/);
    expect(audit[0].summary).toMatch(/name/);

    const meta = JSON.parse(audit[0].metadata!);
    expect(meta.changed).toEqual(['name']);
    expect(meta.before).toEqual({ name: 'Smith Family' });
    expect(meta.after).toEqual({ name: 'Updated Name' });
  });

  it('does not write audit row on a no-op patch', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.updateFamilySettings({
      familyId: 'f-target',
      name: 'Smith Family',
    });
    expect(result.changed).toEqual([]);

    const audit = await db.select().from(centralSchema.platformAuditLog).all();
    expect(audit).toHaveLength(0);
  });

  it('throws NOT_FOUND on unknown family id', async () => {
    const caller = createCaller(adminCtx(db));
    await expect(
      caller.platformAdmin.updateFamilySettings({
        familyId: 'does-not-exist',
        name: 'X',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects non-admin caller (NOT_FOUND)', async () => {
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values({
      id: 'u1', email: 'u1@x.com', name: 'User', createdAt: now, updatedAt: now,
    }).run();

    const caller = createCaller(nonAdminCtx(db));
    await expect(
      caller.platformAdmin.updateFamilySettings({
        familyId: 'f-target',
        name: 'X',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('platformAdmin.changeMemberRole', () => {
  let db: TestCentralDb;

  async function seedFamilyWithMembers(db: TestCentralDb) {
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values([
      { id: 'u-owner',  email: 'o@x.com', name: 'Owner', createdAt: now, updatedAt: now },
      { id: 'u-admin',  email: 'a@x.com', name: 'Admin Member', createdAt: now, updatedAt: now },
      { id: 'u-editor', email: 'e@x.com', name: 'Edith Editor', createdAt: now, updatedAt: now },
    ]).run();
    await db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Smith Family', ownerId: 'u-owner', dbFilename: 'fake.db',
      createdAt: now, updatedAt: now,
    }).run();
    await db.insert(centralSchema.familyMembers).values([
      { id: 'm-owner',  familyId: 'f1', userId: 'u-owner',  role: 'owner',  joinedAt: now, isActive: 1 },
      { id: 'm-admin',  familyId: 'f1', userId: 'u-admin',  role: 'admin',  joinedAt: now, isActive: 1 },
      { id: 'm-editor', familyId: 'f1', userId: 'u-editor', role: 'editor', joinedAt: now, isActive: 1 },
    ]).run();
  }

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedAdmin(db, 'admin1', 'Sarah Admin');
    await seedFamilyWithMembers(db);
  });

  it('promotes editor to admin and bumps version + writes both audit logs', async () => {
    const userBefore = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'u-editor')).get();

    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.changeMemberRole({
      familyId: 'f1',
      userId: 'u-editor',
      role: 'admin',
    });
    expect(result.changed).toBe(true);

    const updated = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.id, 'm-editor')).get();
    expect(updated!.role).toBe('admin');

    const userAfter = await db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.id, 'u-editor')).get();
    expect(userAfter!.membershipsVersion).toBeGreaterThan(userBefore!.membershipsVersion);

    const platformAudit = await db.select().from(centralSchema.platformAuditLog).all();
    expect(platformAudit).toHaveLength(1);
    expect(platformAudit[0].action).toBe('family.member.role-change');
    expect(platformAudit[0].targetType).toBe('family');
    expect(platformAudit[0].summary).toMatch(/Edith Editor/);
    expect(platformAudit[0].summary).toMatch(/from editor to admin/);

    const feed = await db.select().from(centralSchema.activityFeed).all();
    expect(feed).toHaveLength(1);
    expect(feed[0].action).toBe('role_changed');
    expect(feed[0].userId).toBe('admin1');
  });

  it('refuses to demote owner via this path', async () => {
    const caller = createCaller(adminCtx(db));
    await expect(
      caller.platformAdmin.changeMemberRole({
        familyId: 'f1', userId: 'u-owner', role: 'editor',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('returns changed=false for a no-op role change', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.changeMemberRole({
      familyId: 'f1', userId: 'u-editor', role: 'editor',
    });
    expect(result.changed).toBe(false);

    const audit = await db.select().from(centralSchema.platformAuditLog).all();
    expect(audit).toHaveLength(0);
  });

  it('throws NOT_FOUND for a non-member', async () => {
    const caller = createCaller(adminCtx(db));
    await expect(
      caller.platformAdmin.changeMemberRole({
        familyId: 'f1', userId: 'no-such-user', role: 'admin',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('platformAdmin.removeMember', () => {
  let db: TestCentralDb;

  async function seed(db: TestCentralDb) {
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values([
      { id: 'u-owner',  email: 'o@x.com', name: 'Owner',   createdAt: now, updatedAt: now },
      { id: 'u-editor', email: 'e@x.com', name: 'Editor',  createdAt: now, updatedAt: now },
    ]).run();
    await db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Smith Family', ownerId: 'u-owner', dbFilename: 'fake.db',
      createdAt: now, updatedAt: now,
    }).run();
    await db.insert(centralSchema.familyMembers).values([
      { id: 'm-owner',  familyId: 'f1', userId: 'u-owner',  role: 'owner',  joinedAt: now, isActive: 1 },
      { id: 'm-editor', familyId: 'f1', userId: 'u-editor', role: 'editor', joinedAt: now, isActive: 1 },
    ]).run();
  }

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedAdmin(db, 'admin1', 'Sarah Admin');
    await seed(db);
  });

  it('deactivates member, bumps version, writes both audit logs', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.removeMember({
      familyId: 'f1', userId: 'u-editor',
    });
    expect(result.ok).toBe(true);

    const member = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.id, 'm-editor')).get();
    expect(member!.isActive).toBe(0);

    const audit = await db.select().from(centralSchema.platformAuditLog).all();
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('family.member.remove');

    const feed = await db.select().from(centralSchema.activityFeed).all();
    expect(feed[0].action).toBe('member_removed');
  });

  it('refuses to remove the owner', async () => {
    const caller = createCaller(adminCtx(db));
    await expect(
      caller.platformAdmin.removeMember({ familyId: 'f1', userId: 'u-owner' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('platformAdmin.forceTransferOwnership', () => {
  let db: TestCentralDb;

  async function seed(db: TestCentralDb) {
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values([
      { id: 'u-owner',     email: 'o@x.com', name: 'Old Owner', createdAt: now, updatedAt: now },
      { id: 'u-new-owner', email: 'n@x.com', name: 'New Owner', createdAt: now, updatedAt: now },
    ]).run();
    await db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Smith Family', ownerId: 'u-owner', dbFilename: 'fake.db',
      createdAt: now, updatedAt: now,
    }).run();
    await db.insert(centralSchema.familyMembers).values([
      { id: 'm-owner',     familyId: 'f1', userId: 'u-owner',     role: 'owner', joinedAt: now, isActive: 1 },
      { id: 'm-new-owner', familyId: 'f1', userId: 'u-new-owner', role: 'admin', joinedAt: now, isActive: 1 },
    ]).run();
  }

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedAdmin(db, 'admin1', 'Sarah Admin');
    await seed(db);
  });

  it('transfers ownership and updates registry + roles', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.forceTransferOwnership({
      familyId: 'f1', newOwnerUserId: 'u-new-owner',
    });
    expect(result.changed).toBe(true);

    const reg = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, 'f1')).get();
    expect(reg!.ownerId).toBe('u-new-owner');

    const oldOwner = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.id, 'm-owner')).get();
    expect(oldOwner!.role).toBe('admin');

    const newOwner = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.id, 'm-new-owner')).get();
    expect(newOwner!.role).toBe('owner');

    const audit = await db.select().from(centralSchema.platformAuditLog).all();
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('family.ownership.force-transfer');

    const feed = await db.select().from(centralSchema.activityFeed).all();
    expect(feed[0].action).toBe('owner_transferred');
  });

  it('returns changed=false when newOwner is already the owner', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.forceTransferOwnership({
      familyId: 'f1', newOwnerUserId: 'u-owner',
    });
    expect(result.changed).toBe(false);
  });

  it('rejects transfer to non-admin (target must be admin)', async () => {
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values({
      id: 'u-editor', email: 'ed@x.com', name: 'Edi', createdAt: now, updatedAt: now,
    }).run();
    await db.insert(centralSchema.familyMembers).values({
      id: 'm-editor', familyId: 'f1', userId: 'u-editor', role: 'editor', joinedAt: now, isActive: 1,
    }).run();

    const caller = createCaller(adminCtx(db));
    await expect(
      caller.platformAdmin.forceTransferOwnership({
        familyId: 'f1', newOwnerUserId: 'u-editor',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('platformAdmin.listInvitations / revokeInvite', () => {
  let db: TestCentralDb;

  async function seed(db: TestCentralDb) {
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 7 * 86400_000).toISOString();
    const past = new Date(Date.now() - 86400_000).toISOString();

    await db.insert(centralSchema.users).values({
      id: 'u-owner', email: 'o@x.com', name: 'Owner', createdAt: now, updatedAt: now,
    }).run();
    await db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Smith Family', ownerId: 'u-owner', dbFilename: 'fake.db',
      createdAt: now, updatedAt: now,
    }).run();
    await db.insert(centralSchema.familyMembers).values({
      id: 'm-owner', familyId: 'f1', userId: 'u-owner', role: 'owner', joinedAt: now, isActive: 1,
    }).run();
    await db.insert(centralSchema.invitations).values([
      { id: 'inv-pending',  familyId: 'f1', invitedBy: 'u-owner', role: 'editor', token: 'tok-pending',  expiresAt: future, createdAt: now },
      { id: 'inv-revoked',  familyId: 'f1', invitedBy: 'u-owner', role: 'admin',  token: 'tok-revoked',  expiresAt: future, createdAt: now, revokedAt: now, revokedBy: 'u-owner' },
      { id: 'inv-expired',  familyId: 'f1', invitedBy: 'u-owner', role: 'viewer', token: 'tok-expired',  expiresAt: past,    createdAt: now },
      { id: 'inv-accepted', familyId: 'f1', invitedBy: 'u-owner', role: 'editor', token: 'tok-accepted', expiresAt: future, createdAt: now, acceptedAt: now, acceptedBy: 'u-owner' },
    ]).run();
  }

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedAdmin(db, 'admin1', 'Sarah Admin');
    await seed(db);
  });

  it('listInvitations status=pending returns only active invites', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.listInvitations({
      familyId: 'f1', status: 'pending',
    });
    expect(result.map((r) => r.id)).toEqual(['inv-pending']);
    expect(result[0].inviterName).toBe('Owner');
  });

  it('listInvitations status=all returns every row', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.listInvitations({
      familyId: 'f1', status: 'all',
    });
    expect(result).toHaveLength(4);
  });

  it('revokeInvite marks pending invite revoked + writes both audit logs', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.revokeInvite({
      familyId: 'f1', invitationId: 'inv-pending',
    });
    expect(result.revoked).toBe(true);

    const inv = await db.select().from(centralSchema.invitations)
      .where(eq(centralSchema.invitations.id, 'inv-pending')).get();
    expect(inv!.revokedAt).not.toBeNull();
    expect(inv!.revokedBy).toBe('admin1');

    const audit = await db.select().from(centralSchema.platformAuditLog).all();
    expect(audit[0].action).toBe('family.invite.revoke');

    const feed = await db.select().from(centralSchema.activityFeed).all();
    expect(feed[0].action).toBe('invite_revoked');
  });

  it('revokeInvite is idempotent for already-revoked invites', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.revokeInvite({
      familyId: 'f1', invitationId: 'inv-revoked',
    });
    expect(result.revoked).toBe(false);
  });

  it('revokeInvite refuses already-accepted invites', async () => {
    const caller = createCaller(adminCtx(db));
    await expect(
      caller.platformAdmin.revokeInvite({
        familyId: 'f1', invitationId: 'inv-accepted',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('platformAdmin.listAuditLogActions', () => {
  it('returns distinct action keys for an admin', async () => {
    const db = createTestCentralDb();
    await seedAdmin(db, 'admin1', 'Admin One');
    await seedAuditEntry(db, 'e1', { actorUserId: 'admin1', action: 'platform_admin.toggle', createdAt: '2026-01-01T00:00:00Z' });
    await seedAuditEntry(db, 'e2', { actorUserId: 'admin1', action: 'family.settings.update', createdAt: '2026-01-02T00:00:00Z' });
    await seedAuditEntry(db, 'e3', { actorUserId: 'admin1', action: 'platform_admin.toggle', createdAt: '2026-01-03T00:00:00Z' });

    const caller = createCaller(adminCtx(db));
    const actions = await caller.platformAdmin.listAuditLogActions();
    expect(actions).toEqual(['family.settings.update', 'platform_admin.toggle']);
  });

  it('rejects non-admins (NOT_FOUND)', async () => {
    const db = createTestCentralDb();
    const caller = createCaller(nonAdminCtx(db));
    await expect(caller.platformAdmin.listAuditLogActions()).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('platformAdmin.searchUsers', () => {
  let db: TestCentralDb;

  async function seedUserRow(id: string, name: string, email: string) {
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values({
      id, email, name, createdAt: now, updatedAt: now,
    }).run();
  }

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedAdmin(db, 'admin1', 'Admin One');
    await seedUserRow('u1', 'Alice', 'alice@example.com');
    await seedUserRow('u2', 'Bob',   'bob@example.com');
  });

  it('returns matching users for a platform admin', async () => {
    const caller = createCaller(adminCtx(db));
    const rows = await caller.platformAdmin.searchUsers({ q: 'ali', limit: 8 });
    expect(rows.map(r => r.id)).toEqual(['u1']);
    expect(rows[0].ownedFamiliesCount).toBe(0);
  });

  it('rejects a non-platform-admin caller', async () => {
    const caller = createCaller(nonAdminCtx(db, 'u1'));
    await expect(
      caller.platformAdmin.searchUsers({ q: '', limit: 8 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('platformAdmin.createFamily', () => {
  let db: TestCentralDb;

  async function seedRegularUser(id: string, name: string, email: string) {
    const now = new Date().toISOString();
    await db.insert(centralSchema.users).values({
      id, email, name, createdAt: now, updatedAt: now,
    }).run();
  }

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedAdmin(db, 'admin1', 'Admin One');
    await seedRegularUser('owner1', 'Olivia Owner', 'olivia@example.com');
  });

  it('creates a family with the picked owner and default cap', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.createFamily({
      name: 'Owner Family',
      ownerId: 'owner1',
    });

    expect(result.familyId).toBeDefined();
    expect(result.ownerName).toBe('Olivia Owner');
    expect(result.ownerEmail).toBe('olivia@example.com');
    expect(result.name).toBe('Owner Family');

    // Registry row exists with default cap
    const registry = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, result.familyId)).get();
    expect(registry!.ownerId).toBe('owner1');
    expect(registry!.maxMembers).toBe(50);

    // Owner membership row exists with role='owner'
    const member = await db.select().from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.familyId, result.familyId)).get();
    expect(member!.userId).toBe('owner1');
    expect(member!.role).toBe('owner');
    expect(member!.isActive).toBe(1);

    // platform_activity row exists with byPlatformAdmin
    const audit = await db.select().from(centralSchema.platformAuditLog)
      .where(eq(centralSchema.platformAuditLog.action, 'family.create')).get();
    expect(audit).toBeDefined();
    expect(audit!.targetId).toBe(result.familyId);
    expect(audit!.actorUserId).toBe('admin1');
    const meta = JSON.parse(audit!.metadata!);
    expect(meta.byPlatformAdmin).toBe(true);
    expect(meta.ownerUserId).toBe('owner1');
  });

  it('respects an explicit maxMembers override', async () => {
    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.createFamily({
      name: 'Big Family',
      ownerId: 'owner1',
      maxMembers: 200,
    });

    const registry = await db.select().from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, result.familyId)).get();
    expect(registry!.maxMembers).toBe(200);
  });

  it('throws NOT_FOUND when ownerId references a non-existent user', async () => {
    const caller = createCaller(adminCtx(db));
    await expect(
      caller.platformAdmin.createFamily({
        name: 'Ghost Family',
        ownerId: 'no-such-user',
      }),
    ).rejects.toThrow(/owner|not found/i);

    // No registry row was created
    const all = await db.select().from(centralSchema.familyRegistry).all();
    expect(all).toHaveLength(0);
  });

  it('rejects a non-platform-admin caller', async () => {
    const caller = createCaller(nonAdminCtx(db, 'owner1'));
    await expect(
      caller.platformAdmin.createFamily({
        name: 'Disallowed',
        ownerId: 'owner1',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('bumps the expected cache tags on success', async () => {
    const { revalidateTag } = await import('next/cache');
    const revalidateTagMock = vi.mocked(revalidateTag);
    revalidateTagMock.mockClear();

    const caller = createCaller(adminCtx(db));
    const result = await caller.platformAdmin.createFamily({
      name: 'Tagged Family',
      ownerId: 'owner1',
    });

    const calls = revalidateTagMock.mock.calls.map(c => c[0]);
    expect(calls).toContain('platform-families');
    expect(calls).toContain('platform-counts');
    expect(calls).toContain('platform-users');
    expect(calls).toContain(`platform-user:owner1`);
    expect(calls).toContain('platform-audit-log');
    // Sanity: familyId is a uuid, not part of the tag set (no detail page yet)
    expect(calls).not.toContain(`platform-family:${result.familyId}`);
  });
});
