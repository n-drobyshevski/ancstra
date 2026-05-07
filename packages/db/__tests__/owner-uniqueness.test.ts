import { describe, it, expect } from 'vitest';
import * as centralSchema from '../src/central-schema';
import { createTestCentralDb } from '../src/test-fixtures/central-schema';

describe('family_members owner-uniqueness partial index', () => {
  it('rejects a second owner row for the same family', () => {
    const db = createTestCentralDb();
    const now = new Date().toISOString();

    db.insert(centralSchema.users).values([
      { id: 'u1', email: 'a@x', name: 'A', emailVerified: 0, createdAt: now, updatedAt: now },
      { id: 'u2', email: 'b@x', name: 'B', emailVerified: 0, createdAt: now, updatedAt: now },
    ]).run();

    db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Test', ownerId: 'u1', dbFilename: 'f1.db',
      moderationEnabled: 0, maxMembers: 50, monthlyAiBudgetUsd: 10.0,
      createdAt: now, updatedAt: now,
    }).run();

    db.insert(centralSchema.familyMembers).values({
      id: 'm1', familyId: 'f1', userId: 'u1', role: 'owner',
      invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null,
    }).run();

    expect(() =>
      db.insert(centralSchema.familyMembers).values({
        id: 'm2', familyId: 'f1', userId: 'u2', role: 'owner',
        invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null,
      }).run()
    ).toThrow(/UNIQUE constraint failed/);
  });

  it('allows multiple non-owner members in the same family', () => {
    const db = createTestCentralDb();
    const now = new Date().toISOString();

    db.insert(centralSchema.users).values([
      { id: 'u1', email: 'a@x', name: 'A', emailVerified: 0, createdAt: now, updatedAt: now },
      { id: 'u2', email: 'b@x', name: 'B', emailVerified: 0, createdAt: now, updatedAt: now },
      { id: 'u3', email: 'c@x', name: 'C', emailVerified: 0, createdAt: now, updatedAt: now },
    ]).run();

    db.insert(centralSchema.familyRegistry).values({
      id: 'f1', name: 'Test', ownerId: 'u1', dbFilename: 'f1.db',
      moderationEnabled: 0, maxMembers: 50, monthlyAiBudgetUsd: 10.0,
      createdAt: now, updatedAt: now,
    }).run();

    db.insert(centralSchema.familyMembers).values([
      { id: 'm1', familyId: 'f1', userId: 'u1', role: 'admin', invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null },
      { id: 'm2', familyId: 'f1', userId: 'u2', role: 'admin', invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null },
      { id: 'm3', familyId: 'f1', userId: 'u3', role: 'editor', invitedRole: null, joinedAt: now, isActive: 1, lastSeenAt: null },
    ]).run();

    const rows = db.select().from(centralSchema.familyMembers).all();
    expect(rows.length).toBe(3);
  });
});
