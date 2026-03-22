import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { submitContribution, getPendingContributions, reviewContribution } from '../src/moderation';
import { persons, pendingContributions } from '@ancstra/db/family-schema';
import { eq } from 'drizzle-orm';

function createTestDb() {
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
  return drizzle(sqlite, { schema: { persons, pendingContributions } });
}

describe('moderation', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('submitContribution', () => {
    it('creates a pending_contributions row with status pending', () => {
      const payload = JSON.stringify({ sex: 'M', isLiving: true, privacyLevel: 'private' });
      const id = submitContribution(db, {
        userId: 'user-1',
        operation: 'create',
        entityType: 'person',
        payload,
      });

      expect(id).toBeTruthy();

      const rows = db.select().from(pendingContributions).where(eq(pendingContributions.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('pending');
      expect(rows[0].userId).toBe('user-1');
      expect(rows[0].operation).toBe('create');
      expect(rows[0].entityType).toBe('person');
      expect(rows[0].payload).toBe(payload);
    });

    it('stores entityId when provided', () => {
      const id = submitContribution(db, {
        userId: 'user-1',
        operation: 'update',
        entityType: 'person',
        entityId: 'person-123',
        payload: JSON.stringify({ notes: 'updated notes' }),
      });

      const rows = db.select().from(pendingContributions).where(eq(pendingContributions.id, id)).all();
      expect(rows[0].entityId).toBe('person-123');
    });
  });

  describe('getPendingContributions', () => {
    it('returns all contributions with status pending ordered by createdAt', () => {
      // Insert contributions with different statuses
      submitContribution(db, {
        userId: 'user-1',
        operation: 'create',
        entityType: 'person',
        payload: JSON.stringify({ first: true }),
      });

      const secondId = submitContribution(db, {
        userId: 'user-2',
        operation: 'create',
        entityType: 'person',
        payload: JSON.stringify({ second: true }),
      });

      // Manually mark one as approved to ensure it's filtered out
      db.update(pendingContributions)
        .set({ status: 'approved' })
        .where(eq(pendingContributions.id, secondId))
        .run();

      submitContribution(db, {
        userId: 'user-3',
        operation: 'create',
        entityType: 'event',
        payload: JSON.stringify({ third: true }),
      });

      const pending = getPendingContributions(db);
      expect(pending).toHaveLength(2);
      expect(pending[0].userId).toBe('user-1');
      expect(pending[1].userId).toBe('user-3');
    });

    it('returns empty array when no pending contributions', () => {
      const pending = getPendingContributions(db);
      expect(pending).toHaveLength(0);
    });
  });

  describe('reviewContribution — approve', () => {
    it('applies person payload, bumps version, and sets status to approved', () => {
      const personPayload = {
        id: 'new-person-1',
        sex: 'F',
        isLiving: true,
        privacyLevel: 'public',
        notes: 'Test person',
      };

      const contribId = submitContribution(db, {
        userId: 'user-1',
        operation: 'create',
        entityType: 'person',
        payload: JSON.stringify(personPayload),
      });

      const result = reviewContribution(db, {
        contributionId: contribId,
        reviewerId: 'admin-1',
        action: 'approve',
        comment: 'Looks good',
      });

      expect(result.success).toBe(true);
      expect(result.alreadyReviewed).toBeUndefined();

      // Verify contribution status updated
      const contrib = db.select().from(pendingContributions).where(eq(pendingContributions.id, contribId)).all();
      expect(contrib[0].status).toBe('approved');
      expect(contrib[0].reviewerId).toBe('admin-1');
      expect(contrib[0].reviewComment).toBe('Looks good');
      expect(contrib[0].reviewedAt).toBeTruthy();

      // Verify person was created
      const personRows = db.select().from(persons).where(eq(persons.id, 'new-person-1')).all();
      expect(personRows).toHaveLength(1);
      expect(personRows[0].sex).toBe('F');
      expect(personRows[0].privacyLevel).toBe('public');
      expect(personRows[0].notes).toBe('Test person');
      expect(personRows[0].version).toBe(1);
    });
  });

  describe('reviewContribution — reject', () => {
    it('sets status to rejected and adds reviewer comment', () => {
      const contribId = submitContribution(db, {
        userId: 'user-1',
        operation: 'create',
        entityType: 'person',
        payload: JSON.stringify({ id: 'person-x', sex: 'M' }),
      });

      const result = reviewContribution(db, {
        contributionId: contribId,
        reviewerId: 'admin-1',
        action: 'reject',
        comment: 'Insufficient evidence',
      });

      expect(result.success).toBe(true);

      // Verify contribution rejected
      const contrib = db.select().from(pendingContributions).where(eq(pendingContributions.id, contribId)).all();
      expect(contrib[0].status).toBe('rejected');
      expect(contrib[0].reviewComment).toBe('Insufficient evidence');
      expect(contrib[0].reviewerId).toBe('admin-1');
      expect(contrib[0].reviewedAt).toBeTruthy();

      // Verify no person was created
      const personRows = db.select().from(persons).all();
      expect(personRows).toHaveLength(0);
    });
  });

  describe('double-review guard', () => {
    it('returns alreadyReviewed when contribution was already approved', () => {
      const contribId = submitContribution(db, {
        userId: 'user-1',
        operation: 'create',
        entityType: 'person',
        payload: JSON.stringify({ id: 'person-1', sex: 'M' }),
      });

      // First review — approve
      const first = reviewContribution(db, {
        contributionId: contribId,
        reviewerId: 'admin-1',
        action: 'approve',
      });
      expect(first.success).toBe(true);

      // Second review — should be guarded
      const second = reviewContribution(db, {
        contributionId: contribId,
        reviewerId: 'admin-2',
        action: 'reject',
        comment: 'Too late',
      });
      expect(second.success).toBe(false);
      expect(second.alreadyReviewed).toBe(true);
    });

    it('returns alreadyReviewed when contribution was already rejected', () => {
      const contribId = submitContribution(db, {
        userId: 'user-1',
        operation: 'create',
        entityType: 'person',
        payload: JSON.stringify({ id: 'person-2', sex: 'F' }),
      });

      // First review — reject
      reviewContribution(db, {
        contributionId: contribId,
        reviewerId: 'admin-1',
        action: 'reject',
        comment: 'No',
      });

      // Second review — should be guarded
      const second = reviewContribution(db, {
        contributionId: contribId,
        reviewerId: 'admin-2',
        action: 'approve',
      });
      expect(second.success).toBe(false);
      expect(second.alreadyReviewed).toBe(true);
    });
  });
});
