import { eq, and, sql } from 'drizzle-orm';
import { pendingContributions, persons } from '@ancstra/db/family-schema';
import type { ContributionOperation, ContributionEntityType } from './types';

type FamilyDb = Parameters<typeof pendingContributions._.columns.id.$defaultFn>[0] extends never
  ? never
  : // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any;

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

export function submitContribution(
  familyDb: FamilyDb,
  opts: {
    userId: string;
    operation: ContributionOperation;
    entityType: ContributionEntityType;
    entityId?: string;
    payload: string;
  },
): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  familyDb
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

export function getPendingContributions(familyDb: FamilyDb): Contribution[] {
  return familyDb
    .select()
    .from(pendingContributions)
    .where(eq(pendingContributions.status, 'pending'))
    .orderBy(pendingContributions.createdAt)
    .all();
}

export function reviewContribution(
  familyDb: FamilyDb,
  opts: {
    contributionId: string;
    reviewerId: string;
    action: 'approve' | 'reject';
    comment?: string;
  },
): { success: boolean; alreadyReviewed?: boolean } {
  const now = new Date().toISOString();
  const newStatus = opts.action === 'approve' ? 'approved' : 'rejected';

  // Atomic double-review guard: only update if still pending
  const result = familyDb
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
  if (result.changes === 0) {
    return { success: false, alreadyReviewed: true };
  }

  // On approve, apply the payload
  if (opts.action === 'approve') {
    const contrib = familyDb
      .select()
      .from(pendingContributions)
      .where(eq(pendingContributions.id, opts.contributionId))
      .get();

    if (contrib) {
      applyContribution(familyDb, contrib);
    }
  }

  return { success: true };
}

function applyContribution(
  familyDb: FamilyDb,
  contrib: Contribution,
): void {
  const payload = JSON.parse(contrib.payload);

  if (contrib.entityType === 'person') {
    if (contrib.operation === 'create') {
      applyPersonCreate(familyDb, payload, contrib.userId);
    }
    // Future: handle update and delete operations
  }
  // Future: handle other entity types (family, event, source, media)
}

function applyPersonCreate(
  familyDb: FamilyDb,
  payload: Record<string, unknown>,
  createdBy: string,
): void {
  const now = new Date().toISOString();

  familyDb
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
