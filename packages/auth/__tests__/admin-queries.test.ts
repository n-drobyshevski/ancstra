import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
import {
  listAuditLog,
  listAuditLogActions,
  logPlatformActivity,
  getPlatformCounts,
} from '../src/admin-queries';

async function seedActor(db: TestCentralDb, id: string, name: string) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values({
    id, email: `${id}@example.com`, name, createdAt: now, updatedAt: now,
  }).run();
}

async function insertEntry(db: TestCentralDb, id: string, opts: {
  actorUserId: string;
  action?: string;
  targetType?: 'user' | 'family';
  targetId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}) {
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

describe('listAuditLog', () => {
  let db: TestCentralDb;

  beforeEach(async () => {
    db = createTestCentralDb();
    await seedActor(db, 'admin1', 'Admin One');
    await seedActor(db, 'admin2', 'Admin Two');
  });

  it('returns empty result when log is empty', async () => {
    const result = await listAuditLog(db);
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it('returns entries newest-first with actor enrichment', async () => {
    await insertEntry(db, 'e1', { actorUserId: 'admin1', summary: 'First',  createdAt: '2026-01-01T00:00:00Z' });
    await insertEntry(db, 'e2', { actorUserId: 'admin2', summary: 'Second', createdAt: '2026-01-02T00:00:00Z' });
    await insertEntry(db, 'e3', { actorUserId: 'admin1', summary: 'Third',  createdAt: '2026-01-03T00:00:00Z' });

    const { items } = await listAuditLog(db);
    expect(items.map(i => i.id)).toEqual(['e3', 'e2', 'e1']);
    expect(items[0].actorName).toBe('Admin One');
    expect(items[0].actorEmail).toBe('admin1@example.com');
    expect(items[1].actorName).toBe('Admin Two');
  });

  it('parses metadata JSON', async () => {
    await insertEntry(db, 'e1', {
      actorUserId: 'admin1',
      metadata: { previous: false, next: true },
      createdAt: '2026-01-01T00:00:00Z',
    });

    const { items } = await listAuditLog(db);
    expect(items[0].metadata).toEqual({ previous: false, next: true });
  });

  it('returns null metadata when not set', async () => {
    await insertEntry(db, 'e1', { actorUserId: 'admin1', createdAt: '2026-01-01T00:00:00Z' });
    const { items } = await listAuditLog(db);
    expect(items[0].metadata).toBeNull();
  });

  it('paginates with cursor — second page picks up where first left off', async () => {
    for (let i = 1; i <= 5; i++) {
      await insertEntry(db, `e${i}`, {
        actorUserId: 'admin1',
        createdAt: `2026-01-0${i}T00:00:00Z`,
      });
    }

    const page1 = await listAuditLog(db, { limit: 2 });
    expect(page1.items.map(i => i.id)).toEqual(['e5', 'e4']);
    expect(page1.nextCursor).toBe('e4');

    const page2 = await listAuditLog(db, { limit: 2, cursor: page1.nextCursor! });
    expect(page2.items.map(i => i.id)).toEqual(['e3', 'e2']);
    expect(page2.nextCursor).toBe('e2');

    const page3 = await listAuditLog(db, { limit: 2, cursor: page2.nextCursor! });
    expect(page3.items.map(i => i.id)).toEqual(['e1']);
    expect(page3.nextCursor).toBeNull();
  });

  it('cursor pagination is stable when entries share a createdAt timestamp', async () => {
    const ts = '2026-01-01T00:00:00Z';
    // Insert in id-DESC order so first row returned has the largest id.
    await insertEntry(db, 'a1', { actorUserId: 'admin1', createdAt: ts });
    await insertEntry(db, 'a2', { actorUserId: 'admin1', createdAt: ts });
    await insertEntry(db, 'a3', { actorUserId: 'admin1', createdAt: ts });

    const page1 = await listAuditLog(db, { limit: 2 });
    expect(page1.items.map(i => i.id)).toEqual(['a3', 'a2']);

    const page2 = await listAuditLog(db, { limit: 2, cursor: 'a2' });
    expect(page2.items.map(i => i.id)).toEqual(['a1']);
    expect(page2.nextCursor).toBeNull();
  });

  it('filters by actorUserId', async () => {
    await insertEntry(db, 'e1', { actorUserId: 'admin1', createdAt: '2026-01-01T00:00:00Z' });
    await insertEntry(db, 'e2', { actorUserId: 'admin2', createdAt: '2026-01-02T00:00:00Z' });
    await insertEntry(db, 'e3', { actorUserId: 'admin1', createdAt: '2026-01-03T00:00:00Z' });

    const { items } = await listAuditLog(db, { actorUserId: 'admin1' });
    expect(items.map(i => i.id)).toEqual(['e3', 'e1']);
  });

  it('filters by action', async () => {
    await insertEntry(db, 'e1', { actorUserId: 'admin1', action: 'platform_admin.toggle', createdAt: '2026-01-01T00:00:00Z' });
    await insertEntry(db, 'e2', { actorUserId: 'admin1', action: 'family.settings.update', createdAt: '2026-01-02T00:00:00Z' });

    const { items } = await listAuditLog(db, { action: 'family.settings.update' });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('e2');
  });

  it('filters by targetType + targetId', async () => {
    await insertEntry(db, 'e1', { actorUserId: 'admin1', targetType: 'user', targetId: 'u1', createdAt: '2026-01-01T00:00:00Z' });
    await insertEntry(db, 'e2', { actorUserId: 'admin1', targetType: 'family', targetId: 'f1', createdAt: '2026-01-02T00:00:00Z' });

    const familyOnly = await listAuditLog(db, { targetType: 'family' });
    expect(familyOnly.items.map(i => i.id)).toEqual(['e2']);

    const specific = await listAuditLog(db, { targetType: 'user', targetId: 'u1' });
    expect(specific.items.map(i => i.id)).toEqual(['e1']);
  });

  it('filters by since/until inclusive bounds', async () => {
    await insertEntry(db, 'e1', { actorUserId: 'admin1', createdAt: '2026-01-01T00:00:00Z' });
    await insertEntry(db, 'e2', { actorUserId: 'admin1', createdAt: '2026-01-02T00:00:00Z' });
    await insertEntry(db, 'e3', { actorUserId: 'admin1', createdAt: '2026-01-03T00:00:00Z' });

    const ranged = await listAuditLog(db, {
      since: '2026-01-02T00:00:00Z',
      until: '2026-01-02T00:00:00Z',
    });
    expect(ranged.items.map(i => i.id)).toEqual(['e2']);
  });

  it('clamps limit to [1, 200]', async () => {
    for (let i = 1; i <= 3; i++) {
      await insertEntry(db, `e${i}`, {
        actorUserId: 'admin1',
        createdAt: `2026-01-0${i}T00:00:00Z`,
      });
    }
    const tinyLimit = await listAuditLog(db, { limit: 0 });
    expect(tinyLimit.items).toHaveLength(1);

    const wayTooBig = await listAuditLog(db, { limit: 99999 });
    expect(wayTooBig.items).toHaveLength(3);
  });
});

describe('listAuditLogActions', () => {
  it('returns distinct action names sorted', async () => {
    const db = createTestCentralDb();
    await seedActor(db, 'admin1', 'Admin One');
    await insertEntry(db, 'e1', { actorUserId: 'admin1', action: 'family.settings.update', createdAt: '2026-01-01T00:00:00Z' });
    await insertEntry(db, 'e2', { actorUserId: 'admin1', action: 'platform_admin.toggle',  createdAt: '2026-01-02T00:00:00Z' });
    await insertEntry(db, 'e3', { actorUserId: 'admin1', action: 'platform_admin.toggle',  createdAt: '2026-01-03T00:00:00Z' });

    const actions = await listAuditLogActions(db);
    expect(actions).toEqual(['family.settings.update', 'platform_admin.toggle']);
  });

  it('returns empty array on empty log', async () => {
    const db = createTestCentralDb();
    const actions = await listAuditLogActions(db);
    expect(actions).toEqual([]);
  });
});

describe('getPlatformCounts pendingInvitesTotal', () => {
  it('counts only pending invites — excludes accepted, revoked, expired', async () => {
    const db = createTestCentralDb();
    const now = new Date('2026-05-07T12:00:00Z');
    const past = new Date(now.getTime() - 86400_000).toISOString();
    const future = new Date(now.getTime() + 7 * 86400_000).toISOString();
    const nowIso = now.toISOString();

    await db.insert(centralSchema.users).values({
      id: 'u-owner', email: 'o@x.com', name: 'Owner', createdAt: nowIso, updatedAt: nowIso,
    }).run();
    await db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Smith', ownerId: 'u-owner', dbFilename: 'fake.db',
      createdAt: nowIso, updatedAt: nowIso,
    }).run();
    await db.insert(centralSchema.invitations).values([
      // Pending — should be counted
      { id: 'i-pending-1', familyId: 'f1', invitedBy: 'u-owner', role: 'editor', token: 't1', expiresAt: future, createdAt: nowIso },
      { id: 'i-pending-2', familyId: 'f1', invitedBy: 'u-owner', role: 'admin',  token: 't2', expiresAt: future, createdAt: nowIso },
      // Excluded — accepted
      { id: 'i-accepted',  familyId: 'f1', invitedBy: 'u-owner', role: 'editor', token: 't3', expiresAt: future, createdAt: nowIso, acceptedAt: nowIso, acceptedBy: 'u-owner' },
      // Excluded — revoked
      { id: 'i-revoked',   familyId: 'f1', invitedBy: 'u-owner', role: 'editor', token: 't4', expiresAt: future, createdAt: nowIso, revokedAt: nowIso, revokedBy: 'u-owner' },
      // Excluded — expired
      { id: 'i-expired',   familyId: 'f1', invitedBy: 'u-owner', role: 'editor', token: 't5', expiresAt: past,    createdAt: nowIso },
    ]).run();

    const counts = await getPlatformCounts(db, now);
    expect(counts.pendingInvitesTotal).toBe(2);
    expect(counts.familyCount).toBe(1);
    expect(counts.userCount).toBe(1);
  });
});

describe('logPlatformActivity → listAuditLog round trip', () => {
  it('round-trips a metadata object', async () => {
    const db = createTestCentralDb();
    await seedActor(db, 'admin1', 'Admin One');

    await logPlatformActivity(db, {
      actorUserId: 'admin1',
      action: 'platform_admin.toggle',
      targetType: 'user',
      targetId: 'u123',
      summary: 'Promoted Bob',
      metadata: { previous: false, next: true, by: 'admin1' },
    });

    const { items } = await listAuditLog(db);
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe('platform_admin.toggle');
    expect(items[0].targetType).toBe('user');
    expect(items[0].targetId).toBe('u123');
    expect(items[0].summary).toBe('Promoted Bob');
    expect(items[0].metadata).toEqual({ previous: false, next: true, by: 'admin1' });
    expect(items[0].actorName).toBe('Admin One');
  });
});
