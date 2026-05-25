import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';
import { logReverseEvent } from '../audit/log-reverse-event';
import { ReasonRequiredError } from '../audit/reason';
import {
  getClusterMembership,
  getClusterMemberFactsheetIds,
  LegacyClusterNotSupportedError,
} from './cluster';
import { _unmergeFactsheetInTransaction } from './unmerge';

/**
 * Bundle D 2026-05-25 — atomic reverse of `promoteFactsheetCluster`.
 *
 * See: docs/superpowers/specs/2026-05-25-research-flow-unification-bundle-d-design.md §3.5.
 *
 * Deletes the families/children edges that span cluster members FIRST (FK
 * dependency: children → families → persons), then calls Bundle C's
 * `_unmergeFactsheetInTransaction` with `skipDirtyCheck: true` +
 * `skipClusterCheck: true` per cluster member — that helper does the actual
 * person + citation + name + event deletes plus the factsheet status revert.
 * Finally clears `cluster_promotion_id` so the unmerged factsheets are no
 * longer cluster-tagged and per-factsheet operations (solo-unmerge, detach,
 * patch) accept them again.
 *
 * One outer transaction wraps the whole operation — a mid-flight failure
 * rolls everything back and the cluster stays intact.
 */

export interface UnmergeFactsheetClusterInput {
  factsheetId: string;
  reason: string;
  actorId: string;
  threadId?: string | null;
}

export interface UnmergeFactsheetClusterResult {
  memberCount: number;
  clusterUnmergeId: string;
  clusterPromotionId: string;
}

/**
 * Thrown when `unmergeFactsheetCluster` is called on a factsheet whose
 * membership resolves to `kind: 'no'` — i.e. solo-promoted or unpromoted.
 * Callers should route through the per-factsheet `unmergeFactsheet` path
 * instead. Stays in this file (not vocab.ts) because it is a function-call
 * argument error, not a route-level cluster-op refusal that the UI binds
 * against.
 */
export class FactsheetNotPromotedAsClusterError extends Error {
  readonly kind = 'FactsheetNotPromotedAsCluster' as const;
  constructor(public readonly factsheetId: string) {
    super(
      `Factsheet ${factsheetId} is not a cluster member — use unmergeFactsheet ` +
        `for solo unmerge.`,
    );
    this.name = 'FactsheetNotPromotedAsClusterError';
  }
}

/**
 * Reverse a cluster promotion atomically.
 *
 * Returns the size of the cluster that was reversed plus the
 * `clusterUnmergeId` correlation id (one value, shared across all per-member
 * audit events so a future audit reader can re-group them).
 *
 * Throws:
 *   - `ReasonRequiredError`               — reason missing or empty.
 *   - `FactsheetNotPromotedAsClusterError` — membership is 'no' (solo / unpromoted).
 *   - `LegacyClusterNotSupportedError`     — membership is 'legacy'.
 */
export async function unmergeFactsheetCluster(
  db: Database,
  input: UnmergeFactsheetClusterInput,
): Promise<UnmergeFactsheetClusterResult> {
  const trimmed = input.reason?.trim() ?? '';
  if (trimmed.length === 0) {
    throw new ReasonRequiredError('unmergeFactsheetCluster', 'reason is required');
  }

  // 1. Resolve membership BEFORE opening a transaction. Cheap reads.
  const membership = await getClusterMembership(db, input.factsheetId);
  if (membership.kind === 'no') {
    throw new FactsheetNotPromotedAsClusterError(input.factsheetId);
  }
  if (membership.kind === 'legacy') {
    throw new LegacyClusterNotSupportedError(input.factsheetId);
  }
  const clusterPromotionId = membership.clusterPromotionId;

  // 2. Resolve all member factsheet IDs + their promoted_person_ids BEFORE
  //    any mutation. `_unmergeFactsheetInTransaction` clears
  //    promoted_person_id on the factsheet row, so we MUST capture the link
  //    upfront for the audit payloads.
  const memberIds = await getClusterMemberFactsheetIds(db, clusterPromotionId);
  if (memberIds.length === 0) {
    // Defensive — getClusterMembership returned 'precise' so at least the
    // input factsheet should be on this list. Treat the impossible-state as
    // "not a cluster".
    throw new FactsheetNotPromotedAsClusterError(input.factsheetId);
  }

  const memberPersonRows = await db.all<{
    id: string;
    promoted_person_id: string | null;
  }>(sql`
    SELECT id, promoted_person_id FROM factsheets
    WHERE cluster_promotion_id = ${clusterPromotionId}
  `);
  const personIdByFactsheet = new Map<string, string | null>();
  const memberPersonIds: string[] = [];
  for (const r of memberPersonRows) {
    personIdByFactsheet.set(r.id, r.promoted_person_id);
    if (r.promoted_person_id) memberPersonIds.push(r.promoted_person_id);
  }

  const clusterUnmergeId = crypto.randomUUID();
  const memberCount = memberIds.length;

  // 3. ONE outer BEGIN IMMEDIATE — every delete + factsheet revert + audit
  //    write must commit or roll back together (spec §3.5).
  //    Explicit BEGIN/COMMIT/ROLLBACK — see project memory
  //    feedback_drizzle_transactions.md (Drizzle's db.transaction() breaks on
  //    better-sqlite3).
  await db.run(sql`BEGIN IMMEDIATE`);
  try {
    // 3a. Delete children edges referencing any member person, EITHER
    //     directly (children.person_id) OR transitively (the family they sit
    //     in references a member person). FK dependency order requires
    //     children before families before persons.
    if (memberPersonIds.length > 0) {
      const idsSql = sql.join(
        memberPersonIds.map((id) => sql`${id}`),
        sql`, `,
      );

      // children → families pre-step: find every family that touches a member
      // person; children rows inside those families must be wiped even if
      // their person_id is some other (non-member) child of the cluster
      // couple. Otherwise the families DELETE below would FK-violate.
      const familyRows = await db.all<{ id: string }>(sql`
        SELECT id FROM families
        WHERE partner1_id IN (${idsSql}) OR partner2_id IN (${idsSql})
      `);
      const familyIds = familyRows.map((r) => r.id);

      if (familyIds.length > 0) {
        const famIdsSql = sql.join(
          familyIds.map((id) => sql`${id}`),
          sql`, `,
        );
        await db.run(sql`
          DELETE FROM children
          WHERE family_id IN (${famIdsSql}) OR person_id IN (${idsSql})
        `);
      } else {
        // No families touch members; only direct children.person_id matches
        // remain (shouldn't happen for a cluster, but be defensive).
        await db.run(sql`
          DELETE FROM children WHERE person_id IN (${idsSql})
        `);
      }

      // 3b. Delete families that reference any member person.
      await db.run(sql`
        DELETE FROM families
        WHERE partner1_id IN (${idsSql}) OR partner2_id IN (${idsSql})
      `);
    }

    // 3c. Per-member: call the Bundle C inner unmerge with both flags set so
    //     it (i) does not refuse dirty persons, (ii) does not refuse cluster
    //     members (we ARE the cluster-level driver). The helper clears
    //     promoted_person_id and reverts the factsheet status.
    for (const memberId of memberIds) {
      await _unmergeFactsheetInTransaction(db, {
        factsheetId: memberId,
        skipDirtyCheck: true,
        skipClusterCheck: true,
      });
    }

    // 3d. Clear cluster_promotion_id on every member. Without this the
    //     factsheets would still resolve to `kind: 'precise'` on a fresh
    //     `getClusterMembership` call, blocking subsequent per-factsheet
    //     operations (solo-unmerge, detach, patch). The cluster is gone.
    const now = new Date().toISOString();
    await db.run(sql`
      UPDATE factsheets
      SET cluster_promotion_id = NULL,
          updated_at = ${now}
      WHERE cluster_promotion_id = ${clusterPromotionId}
    `);

    // 3e. Per-member audit event. `clusterUnmergeId` is shared across all
    //     events so a downstream reader can re-group. `personId` is the
    //     pre-delete person id captured at step 2.
    for (const memberId of memberIds) {
      await logReverseEvent({
        db,
        eventType: 'factsheet_unmerged',
        reason: trimmed,
        actorId: input.actorId,
        threadId: input.threadId ?? null,
        factsheetId: memberId,
        personId: personIdByFactsheet.get(memberId) ?? null,
        payload: {
          clusterUnmergeId,
          clusterPromotionId,
          clusterSize: memberCount,
        },
      });
    }

    await db.run(sql`COMMIT`);
    return { memberCount, clusterUnmergeId, clusterPromotionId };
  } catch (err) {
    await db.run(sql`ROLLBACK`);
    throw err;
  }
}
