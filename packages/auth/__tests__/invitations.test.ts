import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
import {
  generateInviteToken,
  createInvitation,
  validateInviteToken,
  acceptInvite,
  revokeInvite,
} from '../src/invitations';

function seedTestData(db: TestCentralDb) {
  const now = new Date().toISOString();

  // Create users
  db.insert(centralSchema.users).values([
    { id: 'user-owner', email: 'owner@test.com', name: 'Owner', createdAt: now, updatedAt: now },
    { id: 'user-admin', email: 'admin@test.com', name: 'Admin', createdAt: now, updatedAt: now },
    { id: 'user-invitee', email: 'invitee@test.com', name: 'Invitee', createdAt: now, updatedAt: now },
  ]).run();

  // Create family
  db.insert(centralSchema.familyRegistry).values({
    id: 'family-1',
    name: 'Test Family',
    ownerId: 'user-owner',
    dbFilename: 'test-family.db',
    maxMembers: 50,
    createdAt: now,
    updatedAt: now,
  }).run();

  // Owner is a family member
  db.insert(centralSchema.familyMembers).values({
    id: 'fm-owner',
    familyId: 'family-1',
    userId: 'user-owner',
    role: 'owner',
    joinedAt: now,
  }).run();
}

describe('generateInviteToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateInviteToken()));
    expect(tokens.size).toBe(100);
  });
});

describe('createInvitation', () => {
  let db: TestCentralDb;

  beforeEach(() => {
    db = createTestCentralDb();
    seedTestData(db);
  });

  it('creates an invitation and returns token', async () => {
    const invitation = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-owner',
      email: 'new@test.com',
      role: 'editor',
      inviterRole: 'owner',
    });

    expect(invitation).toBeDefined();
    expect(invitation.token).toHaveLength(64);
    expect(invitation.familyId).toBe('family-1');
    expect(invitation.role).toBe('editor');
    expect(invitation.email).toBe('new@test.com');
    expect(invitation.acceptedAt).toBeNull();
    expect(invitation.revokedAt).toBeNull();
  });

  it('enforces max 20 active invitations per family', async () => {
    // Create 20 invitations
    for (let i = 0; i < 20; i++) {
      await createInvitation(db, {
        familyId: 'family-1',
        invitedById: 'user-owner',
        role: 'viewer',
        inviterRole: 'owner',
      });
    }

    // 21st should fail
    await expect(
      createInvitation(db, {
        familyId: 'family-1',
        invitedById: 'user-owner',
        role: 'viewer',
        inviterRole: 'owner',
      })
    ).rejects.toThrow('Maximum active invitation limit (20) reached');
  });

  it('only owner can invite admin', async () => {
    await expect(
      createInvitation(db, {
        familyId: 'family-1',
        invitedById: 'user-admin',
        role: 'admin',
        inviterRole: 'admin',
      })
    ).rejects.toThrow('Only owners can invite admins');
  });

  it('owner can invite admin', async () => {
    const invitation = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-owner',
      role: 'admin',
      inviterRole: 'owner',
    });

    expect(invitation.role).toBe('admin');
  });

  it('admin can invite editor or viewer', async () => {
    const editorInvite = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-admin',
      role: 'editor',
      inviterRole: 'admin',
    });
    expect(editorInvite.role).toBe('editor');

    const viewerInvite = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-admin',
      role: 'viewer',
      inviterRole: 'admin',
    });
    expect(viewerInvite.role).toBe('viewer');
  });
});

describe('validateInviteToken', () => {
  let db: TestCentralDb;

  beforeEach(() => {
    db = createTestCentralDb();
    seedTestData(db);
  });

  it('returns valid for a good token', async () => {
    const invitation = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-owner',
      role: 'editor',
      inviterRole: 'owner',
    });

    const result = await validateInviteToken(db, invitation.token);
    expect(result.valid).toBe(true);
    expect(result.invitation).toBeDefined();
    expect(result.invitation!.id).toBe(invitation.id);
  });

  it('returns invalid for non-existent token', async () => {
    const result = await validateInviteToken(db, 'nonexistent-token');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invitation not found');
  });

  it('returns invalid for expired token', async () => {
    const invitation = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-owner',
      role: 'editor',
      inviterRole: 'owner',
      expiresInDays: -1, // already expired
    });

    const result = await validateInviteToken(db, invitation.token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invitation has expired');
  });

  it('returns invalid for revoked token', async () => {
    const invitation = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-owner',
      role: 'editor',
      inviterRole: 'owner',
    });

    await revokeInvite(db, invitation.id, 'user-owner');

    const result = await validateInviteToken(db, invitation.token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invitation has been revoked');
  });

  it('returns invalid for already accepted token', async () => {
    const invitation = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-owner',
      role: 'editor',
      inviterRole: 'owner',
    });

    await acceptInvite(db, invitation.token, 'user-invitee');

    const result = await validateInviteToken(db, invitation.token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invitation has already been accepted');
  });

  it('returns invalid for email mismatch', async () => {
    const invitation = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-owner',
      email: 'specific@test.com',
      role: 'editor',
      inviterRole: 'owner',
    });

    const result = await validateInviteToken(db, invitation.token, 'wrong@test.com');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Email does not match invitation');
  });

  it('returns valid when email matches', async () => {
    const invitation = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-owner',
      email: 'specific@test.com',
      role: 'editor',
      inviterRole: 'owner',
    });

    const result = await validateInviteToken(db, invitation.token, 'specific@test.com');
    expect(result.valid).toBe(true);
  });

  it('returns invalid when family at max_members', async () => {
    // Set max_members to 1 (owner already counts)
    const { eq } = await import('drizzle-orm');
    db.update(centralSchema.familyRegistry)
      .set({ maxMembers: 1 })
      .where(eq(centralSchema.familyRegistry.id, 'family-1'))
      .run();

    const invitation = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-owner',
      role: 'editor',
      inviterRole: 'owner',
    });

    const result = await validateInviteToken(db, invitation.token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Family has reached maximum member limit');
  });
});

describe('acceptInvite', () => {
  let db: TestCentralDb;

  beforeEach(() => {
    db = createTestCentralDb();
    seedTestData(db);
  });

  it('creates family_members row with correct role', async () => {
    const invitation = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-owner',
      role: 'editor',
      inviterRole: 'owner',
    });

    await acceptInvite(db, invitation.token, 'user-invitee');

    // Check family_members row
    const { eq, and } = await import('drizzle-orm');
    const member = db
      .select()
      .from(centralSchema.familyMembers)
      .where(
        and(
          eq(centralSchema.familyMembers.familyId, 'family-1'),
          eq(centralSchema.familyMembers.userId, 'user-invitee')
        )
      )
      .get();

    expect(member).toBeDefined();
    expect(member!.role).toBe('editor');
    expect(member!.invitedRole).toBe('editor');
    expect(member!.familyId).toBe('family-1');
    expect(member!.userId).toBe('user-invitee');
  });

  it('marks invitation as accepted', async () => {
    const invitation = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-owner',
      role: 'viewer',
      inviterRole: 'owner',
    });

    const accepted = await acceptInvite(db, invitation.token, 'user-invitee');

    expect(accepted.acceptedAt).toBeDefined();
    expect(accepted.acceptedAt).not.toBeNull();
    expect(accepted.acceptedBy).toBe('user-invitee');
  });

  it('throws on invalid token', async () => {
    await expect(
      acceptInvite(db, 'bad-token', 'user-invitee')
    ).rejects.toThrow('Invitation not found');
  });
});

describe('revokeInvite', () => {
  let db: TestCentralDb;

  beforeEach(() => {
    db = createTestCentralDb();
    seedTestData(db);
  });

  it('sets revoked_at and revoked_by', async () => {
    const invitation = await createInvitation(db, {
      familyId: 'family-1',
      invitedById: 'user-owner',
      role: 'editor',
      inviterRole: 'owner',
    });

    const revoked = await revokeInvite(db, invitation.id, 'user-owner');

    expect(revoked.revokedAt).toBeDefined();
    expect(revoked.revokedAt).not.toBeNull();
    expect(revoked.revokedBy).toBe('user-owner');
  });

  it('throws for non-existent invitation', async () => {
    await expect(
      revokeInvite(db, 'nonexistent-id', 'user-owner')
    ).rejects.toThrow('Invitation not found');
  });
});
