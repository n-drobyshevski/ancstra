import { cacheLife, cacheTag } from 'next/cache';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  pendingContributions,
  factsheets,
  researchItems,
} from '@ancstra/db';
import { getFamilyDb } from '@/lib/db';

import type { FactsheetStatus } from '@ancstra/db';

// ---------------------------------------------------------------------------
// Editor hero — My contributions status (per-user, all statuses)
// ---------------------------------------------------------------------------
export type MyContributionsStatus = {
  pending: number;
  approved: number;
  rejected: number;
  revisionRequested: number;
  total: number;
};

const ZERO_STATUS: MyContributionsStatus = {
  pending: 0,
  approved: 0,
  rejected: 0,
  revisionRequested: 0,
  total: 0,
};

/**
 * Counts of `pending_contributions` rows authored by `userId`, grouped by
 * status. Note: the `pending_contributions` table actually holds all four
 * lifecycle states — the name is a historical artifact.
 *
 * Tagged so any contribution mutation (submit/review) clears this view.
 * Uses `cache: private` because the result is per-user.
 */
export async function getCachedMyContributionsStatus(
  dbFilename: string,
  userId: string,
): Promise<MyContributionsStatus> {
  'use cache: private';
  cacheLife('dashboard');
  cacheTag('contributions', `contributions-${dbFilename}`, `my-contributions-${userId}`);

  const db = await getFamilyDb(dbFilename);
  const rows = await db
    .select({
      status: pendingContributions.status,
      count: sql<number>`count(*)`,
    })
    .from(pendingContributions)
    .where(eq(pendingContributions.userId, userId))
    .groupBy(pendingContributions.status)
    .all();

  const out: MyContributionsStatus = { ...ZERO_STATUS };
  for (const r of rows) {
    const n = r.count ?? 0;
    switch (r.status) {
      case 'pending': out.pending = n; break;
      case 'approved': out.approved = n; break;
      case 'rejected': out.rejected = n; break;
      case 'revision_requested': out.revisionRequested = n; break;
    }
    out.total += n;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Editor hero — AI suggestions count (research items)
// ---------------------------------------------------------------------------
/**
 * Number of unprocessed AI-suggested research items: `discoveryMethod =
 * 'ai_suggestion'` AND `status = 'collected'` (initial lifecycle state — not
 * yet processed/extracted/discarded). Family-wide (research is collaborative),
 * not per-user.
 */
export async function getCachedAiSuggestionsCount(dbFilename: string): Promise<number> {
  'use cache';
  cacheLife('dashboard');
  cacheTag('research-items', `research-items-${dbFilename}`);

  const db = await getFamilyDb(dbFilename);
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(researchItems)
    .where(
      and(
        eq(researchItems.discoveryMethod, 'ai_suggestion'),
        eq(researchItems.status, 'collected'),
      ),
    )
    .all();

  return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Editor hero — Last factsheet the user touched
// ---------------------------------------------------------------------------
export type LastFactsheet = {
  id: string;
  title: string;
  status: FactsheetStatus;
  updatedAt: string;
} | null;

/**
 * Most-recently-updated factsheet authored by the user, or null. Used by the
 * editor hero's "Continue where you left off" card. We sort by `updatedAt`
 * (not `createdAt`) so saving an existing draft pushes it back to the top.
 */
export async function getCachedLastFactsheetForUser(
  dbFilename: string,
  userId: string,
): Promise<LastFactsheet> {
  'use cache: private';
  cacheLife('dashboard');
  cacheTag('factsheets', `last-factsheet-${userId}`);

  const db = await getFamilyDb(dbFilename);
  const row = await db
    .select({
      id: factsheets.id,
      title: factsheets.title,
      status: factsheets.status,
      updatedAt: factsheets.updatedAt,
    })
    .from(factsheets)
    .where(eq(factsheets.createdBy, userId))
    .orderBy(desc(factsheets.updatedAt))
    .limit(1)
    .get();

  return (row as LastFactsheet) ?? null;
}

// ---------------------------------------------------------------------------
// Editor secondary — Top N recent factsheets (family-wide)
// ---------------------------------------------------------------------------
export type RecentFactsheet = {
  id: string;
  title: string;
  status: FactsheetStatus;
  updatedAt: string;
  createdBy: string;
};

/**
 * Top N factsheets across the whole family by `updatedAt` desc. Used in the
 * editor's @secondary slot ("what's hot in research right now"). Excludes
 * `dismissed` because they're not interesting to surface.
 */
export async function getCachedRecentFactsheets(
  dbFilename: string,
  limit = 5,
): Promise<RecentFactsheet[]> {
  'use cache';
  cacheLife('dashboard');
  cacheTag('factsheets', 'recent-factsheets');

  const db = await getFamilyDb(dbFilename);
  const rows = await db
    .select({
      id: factsheets.id,
      title: factsheets.title,
      status: factsheets.status,
      updatedAt: factsheets.updatedAt,
      createdBy: factsheets.createdBy,
    })
    .from(factsheets)
    .where(sql`${factsheets.status} != 'dismissed'`)
    .orderBy(desc(factsheets.updatedAt))
    .limit(limit)
    .all();

  return rows as RecentFactsheet[];
}
