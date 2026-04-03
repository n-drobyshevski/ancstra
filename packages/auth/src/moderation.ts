import { eq, and, sql } from 'drizzle-orm';
import { pendingContributions, persons } from '@ancstra/db/family-schema';
import type { ContributionOperation, ContributionEntityType } from './types';

// Accept any Drizzle DB instance (works with both better-sqlite3 and libsql drivers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FamilyDb = any;

export interface Contribution {
  id: string;
  userId: string;
  operation: ContributionOperation;
  entityType: ContributionEntityType;
  entityId: string | null;
  payload: string;
  status: string;
  reviewerId: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function submitContribution(
  familyDb: FamilyDb,
  opts: {
    userId: string;
    operation: ContributionOperation;
    entityType: ContributionEntityType;
    entityId?: string;
    payload: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await familyDb
    .insert(pendingContributions)
    .values({
      id,
      userId: opts.userId,
      operation: opts.operation,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      payload: opts.payload,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return id;
}

export async function getPendingContributions(familyDb: FamilyDb): Promise<Contribution[]> {
  return await familyDb
    .select()
    .from(pendingContributions)
    .where(eq(pendingContributions.status, 'pending'))
    .orderBy(pendingContributions.createdAt)
    .all();
}

export async function reviewContribution(
  familyDb: FamilyDb,
  opts: {
    contributionId: string;
    reviewerId: string;
    action: 'approve' | 'reject';
    comment?: string;
  },
): Promise<{ success: boolean; alreadyReviewed?: boolean }> {
  const now = new Date().toISOString();
  const newStatus = opts.action === 'approve' ? 'approved' : 'rejected';

  // Atomic double-review guard: only update if still pending
  const result = await familyDb
    .update(pendingContributions)
    .set({
      status: newStatus,
      reviewerId: opts.reviewerId,
      reviewComment: opts.comment ?? null,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(pendingContributions.id, opts.contributionId),
        eq(pendingContributions.status, 'pending'),
      ),
    )
    .run();

  // If no rows changed, it was already reviewed
  // Handle both better-sqlite3 (result.changes) and libsql (result.rowsAffected) drivers
  const rowsChanged = (result as { changes?: number }).changes ?? (result as { rowsAffected?: number }).rowsAffected ?? 0;
  if (rowsChanged === 0) {
    return { success: false, alreadyReviewed: true };
  }

  // On approve, apply the payload
  if (opts.action === 'approve') {
    const contrib = await familyDb
      .select()
      .from(pendingContributions)
      .where(eq(pendingContributions.id, opts.contributionId))
      .get();

    if (contrib) {
      await applyContribution(familyDb, contrib);
    }
  }

  return { success: true };
}

async function applyContribution(
  familyDb: FamilyDb,
  contrib: Contribution,
): Promise<void> {
  const payload = JSON.parse(contrib.payload);

  if (contrib.entityType === 'person') {
    if (contrib.operation === 'create') {
      await applyPersonCreate(familyDb, payload, contrib.userId);
    }
    // Future: handle update and delete operations
  }
  // Future: handle other entity types (family, event, source, media)
}

async function applyPersonCreate(
  familyDb: FamilyDb,
  payload: Record<string, unknown>,
  createdBy: string,
): Promise<void> {
  const now = new Date().toISOString();

  await familyDb
    .insert(persons)
    .values({
      id: payload.id as string | undefined,
      sex: (payload.sex as 'M' | 'F' | 'U') ?? 'U',
      isLiving: payload.isLiving != null ? Boolean(payload.isLiving) : true,
      privacyLevel: (payload.privacyLevel as 'public' | 'private' | 'restricted') ?? 'private',
      notes: (payload.notes as string) ?? null,
      createdBy,
      createdAt: now,
      updatedAt: now,
      version: 1,
    })
    .run();
}
