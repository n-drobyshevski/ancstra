import { cacheLife, cacheTag } from 'next/cache';
import { eq, and, sql } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { listFamilyInvitations, getPendingContributions } from '@ancstra/auth';
import type { Role, ContributionEntityType } from '@ancstra/auth';
import { getCentralDb } from '@/lib/db-singleton';
import { getFamilyDb } from '@/lib/db';

// ---------------------------------------------------------------------------
// Owner hero — Family health summary
// ---------------------------------------------------------------------------
export interface FamilyHealthSummary {
  /** Counts per role across the *active* (is_active=1) members of the family. */
  memberCounts: Record<Role, number>;
  /** Total active members (sum of memberCounts). */
  totalMembers: number;
  /** Pending invitations: not accepted, not revoked, not expired. */
  pendingInviteCount: number;
}

/**
 * Aggregates the data the owner's family-health hero needs in one cache
 * entry. Tagged so role/membership/invite mutations can revalidate this
 * surface alone:
 *   - `family-members` — bumped by membership add/remove/role-change
 *   - `family-invitations` — bumped by invite create/revoke/accept
 *   - `family-health-{familyId}` — fine-grained for this family only
 */
export async function getCachedFamilyHealthSummary(
  familyId: string,
): Promise<FamilyHealthSummary> {
  'use cache';
  cacheLife('dashboard');
  cacheTag('family-members', 'family-invitations', `family-health-${familyId}`);

  const centralDb = await getCentralDb();

  const [memberRows, invites] = await Promise.all([
    centralDb
      .select({
        role: centralSchema.familyMembers.role,
        count: sql<number>`count(*)`,
      })
      .from(centralSchema.familyMembers)
      .where(
        and(
          eq(centralSchema.familyMembers.familyId, familyId),
          eq(centralSchema.familyMembers.isActive, 1),
        ),
      )
      .groupBy(centralSchema.familyMembers.role)
      .all(),
    listFamilyInvitations(centralDb, familyId, { status: 'pending' }),
  ]);

  const memberCounts: Record<Role, number> = {
    owner: 0,
    admin: 0,
    editor: 0,
    viewer: 0,
  };
  let totalMembers = 0;
  for (const row of memberRows) {
    const role = row.role as Role;
    const n = row.count ?? 0;
    memberCounts[role] = n;
    totalMembers += n;
  }

  return {
    memberCounts,
    totalMembers,
    pendingInviteCount: invites.length,
  };
}

// ---------------------------------------------------------------------------
// Admin hero — Moderation summary
// ---------------------------------------------------------------------------
export interface ModerationSummary {
  /** Total pending contributions awaiting review. */
  pendingCount: number;
  /**
   * Age in whole days of the oldest pending contribution. Null when the queue
   * is empty. Used to surface "stuck" queues in the hero copy.
   */
  oldestAgeDays: number | null;
  /** Pending counts grouped by entity type, descending. Empty when queue is empty. */
  byEntityType: Array<{ entityType: ContributionEntityType; count: number }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Aggregates moderation queue stats for the admin hero. Hits the family DB
 * via getPendingContributions and derives the summary in JS — small N (queue
 * caps at the moderation backlog, typically <100). Tagged with `contributions`
 * so any review/submit mutation invalidates this surface.
 */
export async function getCachedModerationSummary(
  dbFilename: string,
): Promise<ModerationSummary> {
  'use cache';
  cacheLife('dashboard');
  cacheTag('contributions', `contributions-${dbFilename}`);

  const familyDb = await getFamilyDb(dbFilename);
  const items = await getPendingContributions(familyDb);

  if (items.length === 0) {
    return { pendingCount: 0, oldestAgeDays: null, byEntityType: [] };
  }

  let oldestMs = Number.POSITIVE_INFINITY;
  const counts: Record<string, number> = {};
  for (const item of items) {
    const t = Date.parse(item.createdAt);
    if (Number.isFinite(t) && t < oldestMs) oldestMs = t;
    counts[item.entityType] = (counts[item.entityType] ?? 0) + 1;
  }

  const oldestAgeDays = Number.isFinite(oldestMs)
    ? Math.max(0, Math.floor((Date.now() - oldestMs) / DAY_MS))
    : null;

  const byEntityType = Object.entries(counts)
    .map(([entityType, count]) => ({
      entityType: entityType as ContributionEntityType,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    pendingCount: items.length,
    oldestAgeDays,
    byEntityType,
  };
}
