import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';

/**
 * Bundle D 2026-05-25 — Cluster membership detection.
 *
 * See: docs/superpowers/specs/2026-05-25-research-flow-unification-bundle-d-design.md §2.
 *
 * Three-state discriminated union replacing Bundle B's boolean
 * `isClusterPromoted` heuristic. Precise detection consults the new
 * `factsheets.cluster_promotion_id` column (stamped at promote time by
 * `promoteFactsheetCluster`, see spec §3.1). The Bundle B ±5s heuristic is
 * kept ONLY as a safety detector for legacy clusters (pre-Bundle-D
 * promotions) — it is NEVER written to the database (spec §2.4 explains why
 * fabricating cluster IDs would be data corruption).
 */

/**
 * Three-state cluster membership.
 *
 * - 'no'      → solo-promoted or unpromoted factsheet.
 * - 'precise' → Bundle D and later: `cluster_promotion_id` was stamped at
 *                promote time. The `clusterPromotionId` field is the cluster's
 *                identity (shared across every member factsheet).
 * - 'legacy'  → cluster-promoted BEFORE Bundle D: `cluster_promotion_id` is
 *                NULL but the ±5s heuristic detects a families/children row.
 *                Cluster operations are refused on legacy members (spec §5.1).
 */
export type ClusterMembership =
  | { kind: 'no' }
  | { kind: 'precise'; clusterPromotionId: string }
  | { kind: 'legacy' };

/**
 * Private — Bundle B's `_isClusterPromotedForPerson` body, moved here. ONLY
 * used by `getClusterMembership` for legacy detection. Never exported, and
 * its result is never written to the DB. See spec §2.4.
 *
 * Bundle B's `packages/research/src/factsheets/unmerge.ts` still holds the
 * OLD copy of this function — Task 5 of Bundle D refactors that call site
 * and deletes the old copy.
 */
async function _isClusterPromotedHeuristic(
  db: Database,
  personId: string,
  promotedAt: string,
): Promise<boolean> {
  const t = new Date(promotedAt).getTime();
  const lo = new Date(t - 5_000).toISOString();
  const hi = new Date(t + 5_000).toISOString();

  const families = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM families
    WHERE (partner1_id = ${personId} OR partner2_id = ${personId})
      AND created_at BETWEEN ${lo} AND ${hi}
  `);
  if ((families[0]?.n ?? 0) > 0) return true;

  const children = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM children
    WHERE person_id = ${personId}
      AND created_at BETWEEN ${lo} AND ${hi}
  `);
  return (children[0]?.n ?? 0) > 0;
}

/**
 * Resolve cluster membership for a factsheet.
 *
 * Algorithm (spec §2.2):
 *   1. Fetch the factsheet row.
 *   2. If `cluster_promotion_id` is non-null → 'precise'.
 *   3. Else if the row is promoted AND the ±5s heuristic fires → 'legacy'.
 *   4. Else → 'no'.
 *
 * Non-existent factsheet returns `{ kind: 'no' }` (safe default — callers
 * downstream of this check have their own existence guards).
 */
export async function getClusterMembership(
  db: Database,
  factsheetId: string,
): Promise<ClusterMembership> {
  const rows = await db.all<{
    promoted_person_id: string | null;
    promoted_at: string | null;
    cluster_promotion_id: string | null;
  }>(sql`
    SELECT promoted_person_id, promoted_at, cluster_promotion_id
    FROM factsheets WHERE id = ${factsheetId}
  `);
  const row = rows[0];
  if (!row) return { kind: 'no' };

  if (row.cluster_promotion_id) {
    return { kind: 'precise', clusterPromotionId: row.cluster_promotion_id };
  }

  if (row.promoted_person_id && row.promoted_at) {
    const legacy = await _isClusterPromotedHeuristic(
      db,
      row.promoted_person_id,
      row.promoted_at,
    );
    if (legacy) return { kind: 'legacy' };
  }

  return { kind: 'no' };
}

/**
 * Resolve every factsheet that shares a `cluster_promotion_id`. Returns an
 * array of factsheet IDs (including the input factsheet's). Used by
 * Bundle D Task 9's `unmergeFactsheetCluster` and by `getClusterMembers`.
 */
export async function getClusterMemberFactsheetIds(
  db: Database,
  clusterPromotionId: string,
): Promise<string[]> {
  const rows = await db.all<{ id: string }>(sql`
    SELECT id FROM factsheets WHERE cluster_promotion_id = ${clusterPromotionId}
  `);
  return rows.map((r) => r.id);
}

/**
 * Display row for a single cluster member — joined with persons + the
 * primary `person_names` row.
 */
export interface ClusterMember {
  factsheetId: string;
  factsheetTitle: string;
  personId: string;
  personGivenName: string | null;
  personSurname: string | null;
}

/**
 * Resolve cluster members with display data for UI rendering. Joins
 * factsheets + person_names (via the `is_primary = 1` row). Sorted by
 * `factsheets.created_at ASC` so the canonical cluster member ordering is
 * stable across calls.
 */
export async function getClusterMembers(
  db: Database,
  clusterPromotionId: string,
): Promise<ClusterMember[]> {
  const rows = await db.all<{
    factsheet_id: string;
    factsheet_title: string;
    person_id: string;
    given_name: string | null;
    surname: string | null;
  }>(sql`
    SELECT
      f.id AS factsheet_id,
      f.title AS factsheet_title,
      f.promoted_person_id AS person_id,
      pn.given_name AS given_name,
      pn.surname AS surname
    FROM factsheets f
    LEFT JOIN person_names pn
      ON pn.person_id = f.promoted_person_id AND pn.is_primary = 1
    WHERE f.cluster_promotion_id = ${clusterPromotionId}
      AND f.promoted_person_id IS NOT NULL
    ORDER BY f.created_at ASC
  `);
  return rows.map((r) => ({
    factsheetId: r.factsheet_id,
    factsheetTitle: r.factsheet_title,
    personId: r.person_id,
    personGivenName: r.given_name,
    personSurname: r.surname,
  }));
}

/**
 * Count `families` + `children` rows that will be deleted by
 * `unmergeFactsheetCluster`. Used by the cluster unmerge dialog summary
 * line (Bundle D Task 13).
 *
 * IN-list interpolation uses `sql.join` — matches the codebase convention
 * (see `packages/research/src/items/queries.ts` and
 * `packages/research/src/facts/queries.ts`).
 */
export async function getClusterEdgeCount(
  db: Database,
  clusterPromotionId: string,
): Promise<{ families: number; children: number }> {
  const personRows = await db.all<{ promoted_person_id: string }>(sql`
    SELECT promoted_person_id FROM factsheets
    WHERE cluster_promotion_id = ${clusterPromotionId}
      AND promoted_person_id IS NOT NULL
  `);
  const personIds = personRows.map((r) => r.promoted_person_id);
  if (personIds.length === 0) return { families: 0, children: 0 };

  const idsSql = sql.join(
    personIds.map((id) => sql`${id}`),
    sql`, `,
  );

  const familiesRows = await db.all<{ n: number }>(sql`
    SELECT COUNT(DISTINCT id) AS n FROM families
    WHERE partner1_id IN (${idsSql}) OR partner2_id IN (${idsSql})
  `);
  const childrenRows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM children
    WHERE person_id IN (${idsSql})
  `);
  return {
    families: familiesRows[0]?.n ?? 0,
    children: childrenRows[0]?.n ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Error classes
// See Bundle D spec §5.1.
// These REPLACE Bundle B's `ClusterPromotedError` and Bundle C's blanket
// `ClusterUnsupported` refusal. Bundle D Task 5 deletes the old class.
//
// Each `.kind` field is mirrored in `CLUSTER_OP_REFUSAL_KINDS`
// (packages/db/src/vocab.ts) and enforced by the AST guard in
// `packages/db/__tests__/vocab-consistency.test.ts`.
// ---------------------------------------------------------------------------

/**
 * `POST /detach` refusal for cluster members. Detach is per-factsheet by
 * design (spec §3.3) — for cluster members, point the caller at
 * `unmerge-cluster` instead.
 */
export class ClusterDetachNotSupportedError extends Error {
  readonly kind = 'ClusterDetachNotSupported' as const;
  constructor(
    public readonly factsheetId: string,
    public readonly clusterPromotionId: string,
  ) {
    super(
      `Factsheet ${factsheetId} is a cluster member (cluster ${clusterPromotionId}). ` +
        `Detach is not supported on cluster members — use unmerge-cluster instead.`,
    );
    this.name = 'ClusterDetachNotSupportedError';
  }
}

/**
 * `POST /unmerge` refusal for cluster members. Single-factsheet unmerge
 * would leave dangling families/children rows pointing at deleted persons;
 * cluster members must use `unmerge-cluster` (spec §3.2, §3.5).
 */
export class ClusterMemberUseClusterUnmergeError extends Error {
  readonly kind = 'ClusterMemberUseClusterUnmerge' as const;
  constructor(
    public readonly factsheetId: string,
    public readonly clusterPromotionId: string,
  ) {
    super(
      `Factsheet ${factsheetId} is a cluster member (cluster ${clusterPromotionId}). ` +
        `Use unmerge-cluster to reverse a cluster promotion.`,
    );
    this.name = 'ClusterMemberUseClusterUnmergeError';
  }
}

/**
 * Universal refusal for any cluster operation on a legacy (pre-Bundle-D)
 * cluster. The Bundle D feature surface deliberately does NOT support
 * cluster ops on legacy clusters — an admin backfill script will be
 * provided in a follow-up bundle.
 */
export class LegacyClusterNotSupportedError extends Error {
  readonly kind = 'LegacyClusterNotSupported' as const;
  constructor(public readonly factsheetId: string) {
    super(
      `Factsheet ${factsheetId} appears to be part of a legacy cluster ` +
        `(pre-Bundle-D promotion). Cluster operations on legacy clusters are not ` +
        `yet supported. An admin migration script will be provided in a follow-up.`,
    );
    this.name = 'LegacyClusterNotSupportedError';
  }
}
