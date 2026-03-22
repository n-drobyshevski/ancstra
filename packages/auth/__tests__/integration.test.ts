import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and } from 'drizzle-orm';
import * as centralSchema from '@ancstra/db/central-schema';
import { persons, pendingContributions } from '@ancstra/db/family-schema';
import {
  hasPermission,
  requirePermission,
  shouldModerate,
  type Role,
  type Permission,
  ForbiddenError,
  createFamily,
  getFamilyMembership,
  transferOwnership,
  createInvitation,
  validateInviteToken,
  acceptInvite,
  revokeInvite,
  submitContribution,
  getPendingContributions,
  reviewContribution,
  redactForViewer,
  isPresumablyLiving,
} from '../src/index';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function createCentralDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE family_registry (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      db_filename TEXT NOT NULL,
      moderation_enabled INTEGER NOT NULL DEFAULT 0,
      max_members INTEGER NOT NULL DEFAULT 50,
      monthly_ai_budget_usd REAL NOT NULL DEFAULT 10.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE family_members (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'editor', 'viewer')),
      invited_role TEXT,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT,
      UNIQUE(family_id, user_id)
    );

    CREATE TABLE invitations (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
      invited_by TEXT NOT NULL REFERENCES users(id),
      email TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      accepted_by TEXT REFERENCES users(id),
      revoked_at TEXT,
      revoked_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE activity_feed (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      summary TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return { db: drizzle(sqlite, { schema: centralSchema }), sqlite };
}

function createFamilyDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private',
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE pending_contributions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer_id TEXT,
      review_comment TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_pending_status ON pending_contributions(status);
  `);

  return { db: drizzle(sqlite, { schema: { persons, pendingContributions } }), sqlite };
}

function seedUser(
  db: ReturnType<typeof createCentralDb>['db'],
  id: string,
  name: string,
) {
  const now = new Date().toISOString();
  db.insert(centralSchema.users)
    .values({ id, email: `${name.toLowerCase()}@test.com`, name, createdAt: now, updatedAt: now })
    .run();
}

function addMember(
  db: ReturnType<typeof createCentralDb>['db'],
  familyId: string,
  userId: string,
  role: Role,
) {
  const now = new Date().toISOString();
  db.insert(centralSchema.familyMembers)
    .values({ id: crypto.randomUUID(), familyId, userId, role, joinedAt: now, isActive: 1 })
    .run();
}

// ---------------------------------------------------------------------------
// Test 1: Full RBAC across all 4 roles
// ---------------------------------------------------------------------------

describe('RBAC integration', () => {
  const allPermissions: Permission[] = [
    'tree:view', 'tree:export', 'tree:delete',
    'person:create', 'person:edit', 'person:delete',
    'family:create', 'family:edit', 'family:delete',
    'event:create', 'event:edit', 'event:delete',
    'source:create', 'source:edit', 'source:delete',
    'media:upload', 'media:delete',
    'gedcom:import', 'gedcom:export',
    'ai:research',
    'relationship:validate',
    'members:manage', 'members:invite',
    'settings:manage',
    'contributions:review',
    'activity:view',
  ];

  let centralDb: ReturnType<typeof createCentralDb>['db'];
  let familyId: string;

  beforeEach(() => {
    const ctx = createCentralDb();
    centralDb = ctx.db;

    seedUser(centralDb, 'owner-1', 'Owner');
    seedUser(centralDb, 'admin-1', 'Admin');
    seedUser(centralDb, 'editor-1', 'Editor');
    seedUser(centralDb, 'viewer-1', 'Viewer');

    const result = createFamily(centralDb, { name: 'Test Family', ownerId: 'owner-1' });
    familyId = result.familyId;

    addMember(centralDb, familyId, 'admin-1', 'admin');
    addMember(centralDb, familyId, 'editor-1', 'editor');
    addMember(centralDb, familyId, 'viewer-1', 'viewer');
  });

  it('owner has every permission', () => {
    for (const perm of allPermissions) {
      expect(hasPermission('owner', perm)).toBe(true);
    }
  });

  it('admin has all permissions except settings:manage and tree:delete', () => {
    const denied: Permission[] = ['settings:manage', 'tree:delete'];
    for (const perm of allPermissions) {
      if (denied.includes(perm)) {
        expect(hasPermission('admin', perm)).toBe(false);
      } else {
        expect(hasPermission('admin', perm)).toBe(true);
      }
    }
  });

  it('editor can create/edit but not delete, manage, or import', () => {
    const allowed: Permission[] = [
      'tree:view', 'tree:export',
      'person:create', 'person:edit',
      'family:create', 'family:edit',
      'event:create', 'event:edit',
      'source:create', 'source:edit',
      'media:upload',
      'gedcom:export',
      'ai:research',
      'relationship:validate',
      'activity:view',
    ];
    for (const perm of allPermissions) {
      expect(hasPermission('editor', perm)).toBe(allowed.includes(perm));
    }
  });

  it('viewer can only tree:view and activity:view', () => {
    const allowed: Permission[] = ['tree:view', 'activity:view'];
    for (const perm of allPermissions) {
      expect(hasPermission('viewer', perm)).toBe(allowed.includes(perm));
    }
  });

  it('requirePermission throws ForbiddenError for denied actions', () => {
    expect(() => requirePermission('viewer', 'person:edit')).toThrow(ForbiddenError);
    expect(() => requirePermission('editor', 'person:delete')).toThrow(ForbiddenError);
    expect(() => requirePermission('admin', 'settings:manage')).toThrow(ForbiddenError);
    expect(() => requirePermission('owner', 'settings:manage')).not.toThrow();
  });

  it('each member role is correctly stored in DB', () => {
    expect(getFamilyMembership(centralDb, 'owner-1', familyId)!.role).toBe('owner');
    expect(getFamilyMembership(centralDb, 'admin-1', familyId)!.role).toBe('admin');
    expect(getFamilyMembership(centralDb, 'editor-1', familyId)!.role).toBe('editor');
    expect(getFamilyMembership(centralDb, 'viewer-1', familyId)!.role).toBe('viewer');
  });

  it('moderation gates only editors when enabled', () => {
    expect(shouldModerate('owner', true)).toBe(false);
    expect(shouldModerate('admin', true)).toBe(false);
    expect(shouldModerate('editor', true)).toBe(true);
    expect(shouldModerate('viewer', true)).toBe(false);
    expect(shouldModerate('editor', false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Invitation flow end-to-end
// ---------------------------------------------------------------------------

describe('invitation flow', () => {
  let centralDb: ReturnType<typeof createCentralDb>['db'];
  let familyId: string;

  beforeEach(() => {
    const ctx = createCentralDb();
    centralDb = ctx.db;

    seedUser(centralDb, 'owner-1', 'Owner');
    seedUser(centralDb, 'newuser-1', 'NewUser');
    seedUser(centralDb, 'newuser-2', 'OtherUser');

    const result = createFamily(centralDb, { name: 'Smith Family', ownerId: 'owner-1' });
    familyId = result.familyId;
  });

  it('complete invitation lifecycle: create -> validate -> accept', async () => {
    // 1. Owner creates an editor invitation
    const invitation = await createInvitation(centralDb, {
      familyId,
      invitedById: 'owner-1',
      email: 'newuser@test.com',
      role: 'editor',
      inviterRole: 'owner',
    });
    expect(invitation.token).toHaveLength(64);
    expect(invitation.role).toBe('editor');

    // 2. Validate token — should be valid
    const validation = await validateInviteToken(centralDb, invitation.token, 'newuser@test.com');
    expect(validation.valid).toBe(true);
    expect(validation.invitation!.id).toBe(invitation.id);

    // 3. Accept invite as new user
    const accepted = await acceptInvite(centralDb, invitation.token, 'newuser-1');
    expect(accepted.acceptedBy).toBe('newuser-1');
    expect(accepted.acceptedAt).not.toBeNull();

    // 4. Verify new user has editor role in family_members
    const membership = getFamilyMembership(centralDb, 'newuser-1', familyId);
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe('editor');

    // 5. Try accepting same token again — should fail
    await expect(acceptInvite(centralDb, invitation.token, 'newuser-2'))
      .rejects.toThrow('Invitation has already been accepted');
  });

  it('rejects expired token', async () => {
    const invitation = await createInvitation(centralDb, {
      familyId,
      invitedById: 'owner-1',
      role: 'viewer',
      inviterRole: 'owner',
      expiresInDays: -1, // already expired
    });

    const result = await validateInviteToken(centralDb, invitation.token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invitation has expired');

    await expect(acceptInvite(centralDb, invitation.token, 'newuser-1'))
      .rejects.toThrow('Invitation has expired');
  });

  it('rejects revoked token', async () => {
    const invitation = await createInvitation(centralDb, {
      familyId,
      invitedById: 'owner-1',
      role: 'editor',
      inviterRole: 'owner',
    });

    await revokeInvite(centralDb, invitation.id, 'owner-1');

    const result = await validateInviteToken(centralDb, invitation.token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invitation has been revoked');
  });

  it('rejects email mismatch', async () => {
    const invitation = await createInvitation(centralDb, {
      familyId,
      invitedById: 'owner-1',
      email: 'specific@test.com',
      role: 'editor',
      inviterRole: 'owner',
    });

    const result = await validateInviteToken(centralDb, invitation.token, 'wrong@test.com');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Email does not match invitation');
  });

  it('enforces max members limit', async () => {
    // Set max_members to 1 (owner already counts)
    centralDb.update(centralSchema.familyRegistry)
      .set({ maxMembers: 1 })
      .where(eq(centralSchema.familyRegistry.id, familyId))
      .run();

    const invitation = await createInvitation(centralDb, {
      familyId,
      invitedById: 'owner-1',
      role: 'viewer',
      inviterRole: 'owner',
    });

    const result = await validateInviteToken(centralDb, invitation.token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Family has reached maximum member limit');
  });
});

// ---------------------------------------------------------------------------
// Test 3: Optimistic locking
// ---------------------------------------------------------------------------

describe('optimistic locking', () => {
  let familyDb: ReturnType<typeof createFamilyDb>['db'];

  beforeEach(() => {
    const ctx = createFamilyDb();
    familyDb = ctx.db;
  });

  it('succeeds on matching version, fails on stale version', () => {
    const personId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 1. Create a person (version 1)
    familyDb.insert(persons).values({
      id: personId,
      sex: 'M',
      isLiving: true,
      privacyLevel: 'private',
      notes: 'Original notes',
      createdAt: now,
      updatedAt: now,
      version: 1,
    }).run();

    // 2. Read person — confirm version 1
    const person = familyDb.select().from(persons).where(eq(persons.id, personId)).get();
    expect(person!.version).toBe(1);
    expect(person!.notes).toBe('Original notes');

    // 3. Update with version 1 — should succeed (optimistic lock: WHERE version = 1)
    const updateResult = familyDb.update(persons)
      .set({ notes: 'Updated notes', version: 2, updatedAt: new Date().toISOString() })
      .where(and(eq(persons.id, personId), eq(persons.version, 1)))
      .run();

    expect(updateResult.changes).toBe(1);

    // Confirm version is now 2
    const updated = familyDb.select().from(persons).where(eq(persons.id, personId)).get();
    expect(updated!.version).toBe(2);
    expect(updated!.notes).toBe('Updated notes');

    // 4. Attempt update with stale version 1 — should fail (0 rows changed)
    const staleResult = familyDb.update(persons)
      .set({ notes: 'Stale update', version: 2, updatedAt: new Date().toISOString() })
      .where(and(eq(persons.id, personId), eq(persons.version, 1)))
      .run();

    expect(staleResult.changes).toBe(0);

    // 5. Verify the data is still from the successful update
    const current = familyDb.select().from(persons).where(eq(persons.id, personId)).get();
    expect(current!.version).toBe(2);
    expect(current!.notes).toBe('Updated notes');
  });

  it('concurrent-style updates: only the first writer wins', () => {
    const personId = crypto.randomUUID();
    const now = new Date().toISOString();

    familyDb.insert(persons).values({
      id: personId,
      sex: 'F',
      isLiving: true,
      privacyLevel: 'private',
      notes: 'Initial',
      createdAt: now,
      updatedAt: now,
      version: 1,
    }).run();

    // Both "readers" see version 1
    const readVersion = 1;

    // Writer A updates first
    const writerA = familyDb.update(persons)
      .set({ notes: 'Writer A', version: readVersion + 1, updatedAt: new Date().toISOString() })
      .where(and(eq(persons.id, personId), eq(persons.version, readVersion)))
      .run();
    expect(writerA.changes).toBe(1);

    // Writer B tries with the same stale version
    const writerB = familyDb.update(persons)
      .set({ notes: 'Writer B', version: readVersion + 1, updatedAt: new Date().toISOString() })
      .where(and(eq(persons.id, personId), eq(persons.version, readVersion)))
      .run();
    expect(writerB.changes).toBe(0);

    // Final state is Writer A's data
    const final = familyDb.select().from(persons).where(eq(persons.id, personId)).get();
    expect(final!.notes).toBe('Writer A');
    expect(final!.version).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Moderation flow
// ---------------------------------------------------------------------------

describe('moderation flow', () => {
  let familyDb: ReturnType<typeof createFamilyDb>['db'];

  beforeEach(() => {
    const ctx = createFamilyDb();
    familyDb = ctx.db;
  });

  it('editor submission goes to pending, admin approval creates person', () => {
    const personPayload = {
      id: 'person-mod-1',
      sex: 'M',
      isLiving: true,
      privacyLevel: 'private',
      notes: 'Moderated person',
    };

    // 1. Moderation is enabled — editor should go through moderation
    expect(shouldModerate('editor', true)).toBe(true);

    // 2. Editor submits a person creation
    const contribId = submitContribution(familyDb, {
      userId: 'editor-1',
      operation: 'create',
      entityType: 'person',
      payload: JSON.stringify(personPayload),
    });
    expect(contribId).toBeTruthy();

    // 3. Verify person NOT in persons table yet
    const personsBefore = familyDb.select().from(persons).all();
    expect(personsBefore).toHaveLength(0);

    // 4. Verify pending_contributions has the entry
    const pending = getPendingContributions(familyDb);
    expect(pending).toHaveLength(1);
    expect(pending[0].userId).toBe('editor-1');
    expect(pending[0].operation).toBe('create');
    expect(pending[0].entityType).toBe('person');
    expect(pending[0].status).toBe('pending');

    // 5. Admin approves — person now in persons table
    const approveResult = reviewContribution(familyDb, {
      contributionId: contribId,
      reviewerId: 'admin-1',
      action: 'approve',
      comment: 'Verified',
    });
    expect(approveResult.success).toBe(true);

    const personsAfter = familyDb.select().from(persons).where(eq(persons.id, 'person-mod-1')).all();
    expect(personsAfter).toHaveLength(1);
    expect(personsAfter[0].sex).toBe('M');
    expect(personsAfter[0].notes).toBe('Moderated person');
    expect(personsAfter[0].version).toBe(1);
  });

  it('rejection leaves persons table unchanged', () => {
    const contribId = submitContribution(familyDb, {
      userId: 'editor-1',
      operation: 'create',
      entityType: 'person',
      payload: JSON.stringify({ id: 'person-rej-1', sex: 'F' }),
    });

    const result = reviewContribution(familyDb, {
      contributionId: contribId,
      reviewerId: 'admin-1',
      action: 'reject',
      comment: 'Insufficient evidence',
    });
    expect(result.success).toBe(true);

    // No person created
    const allPersons = familyDb.select().from(persons).all();
    expect(allPersons).toHaveLength(0);

    // Contribution marked as rejected
    const contrib = familyDb.select().from(pendingContributions)
      .where(eq(pendingContributions.id, contribId)).get();
    expect(contrib!.status).toBe('rejected');
    expect(contrib!.reviewComment).toBe('Insufficient evidence');
  });

  it('double-review guard prevents second review', () => {
    const contribId = submitContribution(familyDb, {
      userId: 'editor-1',
      operation: 'create',
      entityType: 'person',
      payload: JSON.stringify({ id: 'person-double', sex: 'M' }),
    });

    // First review — approve
    const first = reviewContribution(familyDb, {
      contributionId: contribId,
      reviewerId: 'admin-1',
      action: 'approve',
    });
    expect(first.success).toBe(true);

    // Second review — should be blocked
    const second = reviewContribution(familyDb, {
      contributionId: contribId,
      reviewerId: 'admin-2',
      action: 'reject',
      comment: 'Too late',
    });
    expect(second.success).toBe(false);
    expect(second.alreadyReviewed).toBe(true);

    // Person should still exist (from the first approval)
    const person = familyDb.select().from(persons).where(eq(persons.id, 'person-double')).get();
    expect(person).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 5: Living person redaction
// ---------------------------------------------------------------------------

describe('living person redaction', () => {
  it('redacts living person data, leaves deceased person unchanged', () => {
    const currentYear = new Date().getFullYear();

    const livingPerson = {
      id: 'living-1',
      givenName: 'Alice',
      surname: 'Smith',
      sex: 'F',
      isLiving: true,
      birthDateSort: (currentYear - 30) * 10000 + 101, // born 30 years ago
      // no deathDateSort — living
      notes: 'Private notes about Alice',
      events: [{ type: 'birth', date: '1994-01-01' }],
      mediaIds: ['photo-1', 'photo-2'],
    };

    const deceasedPerson = {
      id: 'deceased-1',
      givenName: 'Robert',
      surname: 'Smith',
      sex: 'M',
      isLiving: false,
      birthDateSort: 19200101,
      deathDateSort: 19900501,
      notes: 'Some historical notes',
      events: [{ type: 'birth', date: '1920-01-01' }, { type: 'death', date: '1990-05-01' }],
      mediaIds: ['photo-3'],
    };

    // Verify living status
    expect(isPresumablyLiving(livingPerson)).toBe(true);
    expect(isPresumablyLiving(deceasedPerson)).toBe(false);

    // Apply redaction
    const redactedLiving = redactForViewer(livingPerson);
    const redactedDeceased = redactForViewer(deceasedPerson);

    // Living person: redacted
    expect(redactedLiving.givenName).toBe('Living');
    expect(redactedLiving.surname).toBe('');
    expect(redactedLiving.notes).toBeNull();
    expect(redactedLiving.events).toEqual([]);
    expect(redactedLiving.mediaIds).toEqual([]);
    // id and sex should be preserved
    expect(redactedLiving.id).toBe('living-1');
    expect(redactedLiving.sex).toBe('F');

    // Deceased person: unchanged
    expect(redactedDeceased.givenName).toBe('Robert');
    expect(redactedDeceased.surname).toBe('Smith');
    expect(redactedDeceased.notes).toBe('Some historical notes');
    expect(redactedDeceased.events).toHaveLength(2);
    expect(redactedDeceased.mediaIds).toEqual(['photo-3']);
  });

  it('treats very old living person (100+ years) as not living', () => {
    const currentYear = new Date().getFullYear();

    const ancientPerson = {
      id: 'ancient-1',
      givenName: 'Martha',
      surname: 'Old',
      sex: 'F',
      isLiving: true,
      birthDateSort: (currentYear - 105) * 10000 + 101, // born 105 years ago
      notes: 'Very old person',
      events: [],
      mediaIds: [],
    };

    // Over 100 years old with no death record — threshold says not living
    expect(isPresumablyLiving(ancientPerson)).toBe(false);

    const redacted = redactForViewer(ancientPerson);
    expect(redacted.givenName).toBe('Martha'); // not redacted
  });

  it('treats person with death date as not living', () => {
    const currentYear = new Date().getFullYear();

    const recentlyDeceased = {
      id: 'recent-deceased',
      givenName: 'John',
      surname: 'Doe',
      sex: 'M',
      isLiving: true, // flag says living but has death date
      birthDateSort: (currentYear - 40) * 10000 + 101,
      deathDateSort: (currentYear - 1) * 10000 + 601,
      notes: 'Passed last year',
      events: [],
      mediaIds: [],
    };

    expect(isPresumablyLiving(recentlyDeceased)).toBe(false);

    const redacted = redactForViewer(recentlyDeceased);
    expect(redacted.givenName).toBe('John'); // not redacted
  });
});

// ---------------------------------------------------------------------------
// Test 6: Owner transfer
// ---------------------------------------------------------------------------

describe('owner transfer', () => {
  let centralDb: ReturnType<typeof createCentralDb>['db'];
  let sqlite: Database.Database;
  let familyId: string;

  beforeEach(() => {
    const ctx = createCentralDb();
    centralDb = ctx.db;
    sqlite = ctx.sqlite;

    seedUser(centralDb, 'owner-1', 'Owner');
    seedUser(centralDb, 'admin-1', 'Admin');
    seedUser(centralDb, 'editor-1', 'Editor');

    const result = createFamily(centralDb, { name: 'Transfer Family', ownerId: 'owner-1' });
    familyId = result.familyId;

    addMember(centralDb, familyId, 'admin-1', 'admin');
    addMember(centralDb, familyId, 'editor-1', 'editor');
  });

  it('transfers ownership from owner to admin', () => {
    const result = transferOwnership(centralDb, {
      familyId,
      currentOwnerId: 'owner-1',
      newOwnerId: 'admin-1',
    });

    expect(result.success).toBe(true);

    // Former owner is now admin
    const formerOwner = getFamilyMembership(centralDb, 'owner-1', familyId);
    expect(formerOwner!.role).toBe('admin');

    // Former admin is now owner
    const newOwner = getFamilyMembership(centralDb, 'admin-1', familyId);
    expect(newOwner!.role).toBe('owner');

    // family_registry.owner_id updated
    const registry = sqlite
      .prepare('SELECT owner_id FROM family_registry WHERE id = ?')
      .get(familyId) as { owner_id: string };
    expect(registry.owner_id).toBe('admin-1');
  });

  it('fails to transfer to non-admin (editor)', () => {
    const result = transferOwnership(centralDb, {
      familyId,
      currentOwnerId: 'owner-1',
      newOwnerId: 'editor-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Target user must be an admin to receive ownership');

    // Roles unchanged
    expect(getFamilyMembership(centralDb, 'owner-1', familyId)!.role).toBe('owner');
    expect(getFamilyMembership(centralDb, 'editor-1', familyId)!.role).toBe('editor');
  });

  it('fails to transfer to non-member', () => {
    seedUser(centralDb, 'outsider-1', 'Outsider');

    const result = transferOwnership(centralDb, {
      familyId,
      currentOwnerId: 'owner-1',
      newOwnerId: 'outsider-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Target user is not a member of this family');
  });

  it('after transfer, new owner has full permissions', () => {
    transferOwnership(centralDb, {
      familyId,
      currentOwnerId: 'owner-1',
      newOwnerId: 'admin-1',
    });

    const newOwnerMembership = getFamilyMembership(centralDb, 'admin-1', familyId);
    expect(newOwnerMembership!.role).toBe('owner');

    // New owner should have settings:manage (only owners get this)
    expect(hasPermission(newOwnerMembership!.role, 'settings:manage')).toBe(true);
    expect(hasPermission(newOwnerMembership!.role, 'tree:delete')).toBe(true);

    // Former owner (now admin) should not
    const formerOwnerMembership = getFamilyMembership(centralDb, 'owner-1', familyId);
    expect(hasPermission(formerOwnerMembership!.role, 'settings:manage')).toBe(false);
  });
});
