import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';
import { logReverseEvent } from '../audit/log-reverse-event';
import { ReasonRequiredError } from '../audit/reason';
import {
  getClusterMembership,
  ClusterMemberUseClusterUnmergeError,
  LegacyClusterNotSupportedError,
} from './cluster';

/**
 * Bundle B 2026-05-24 — atomic single-factsheet unmerge.
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-b-design.md §4.1, §7.
 *
 * - Refuses non-promoted factsheets.
 * - Refuses cluster-promoted factsheets (heuristic: another promotion within ±5s).
 * - Refuses dirty persons (events/persons updated_at > promoted_at).
 * - Deletes promotion artifacts and reverts factsheet status in one transaction.
 * - Emits `factsheet_unmerged` thread event with the user's reason.
 */

export interface UnmergeFactsheetInput {
  factsheetId: string;
  reason: string;
  actorId: string;
  threadId?: string | null;
}

export interface UnmergeFactsheetResult {
  deleted: {
    persons: number;
    events: number;
    names: number;
    sources: number;
    citations: number;
  };
}

export class FactsheetNotPromotedError extends Error {
  constructor(public factsheetId: string) {
    super(`Factsheet ${factsheetId} is not in promoted state`);
    this.name = 'FactsheetNotPromotedError';
  }
}

export class PersonDirtyError extends Error {
  constructor(public personId: string) {
    super(
      `Person ${personId} has been edited since promotion. Revert edits or use Detach (advanced, not implemented in this release).`,
    );
    this.name = 'PersonDirtyError';
  }
}

/**
 * Read the `changes` (better-sqlite3) / `rowsAffected` (libsql) count off a
 * db.run() result. Bare `.changes` is the better-sqlite3 path used in tests;
 * `.rowsAffected` is the libsql/Turso runtime path.
 */
function readChanges(result: unknown): number {
  const r = result as { changes?: number; rowsAffected?: number };
  return Number(r?.changes ?? r?.rowsAffected ?? 0);
}

/**
 * Detect whether the promoted person has been edited since promotion.
 * Compares persons.updated_at and events.updated_at against promotedAt.
 * person_names has no updated_at column; not tracked.
 *
 * Strict `>` comparison: rows created AT promotion time are not dirty.
 */
export async function isPersonDirtySincePromote(
  db: Database,
  personId: string,
  promotedAt: string,
): Promise<boolean> {
  const rows = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM (
      SELECT updated_at FROM persons WHERE id = ${personId}
      UNION ALL
      SELECT updated_at FROM events WHERE person_id = ${personId}
    ) WHERE updated_at > ${promotedAt}
  `);
  return (rows[0]?.n ?? 0) > 0;
}

/**
 * Inner transaction body for unmerge. Caller MUST have already opened a
 * transaction (BEGIN IMMEDIATE) and is responsible for COMMIT/ROLLBACK.
 *
 * Performs cluster + dirty checks, then deletes promotion artifacts.
 * Does NOT write the audit event — caller writes it (so audit can sit inside
 * a multi-step outer transaction like force-repromote in Bundle C Task 8).
 *
 * Returns deletion counts plus the resolved personId and promotedAt that
 * the caller may need for downstream operations (e.g. logging).
 */
export async function _unmergeFactsheetInTransaction(
  db: Database,
  input: Pick<UnmergeFactsheetInput, 'factsheetId'> & {
    skipDirtyCheck?: boolean;
    /**
     * Bundle D 2026-05-25: when true, skip the cluster-member guard. ONLY set
     * by `unmergeFactsheetCluster` (spec §3.5), which is itself responsible
     * for the cluster-level membership check and for ordering child/family
     * deletes correctly. All other callers MUST leave this false so a stray
     * single-factsheet unmerge cannot corrupt a cluster.
     */
    skipClusterCheck?: boolean;
  },
): Promise<UnmergeFactsheetResult & { personId: string; promotedAt: string }> {
  const fsRows = await db.all<{
    status: string;
    promoted_person_id: string | null;
    promoted_at: string | null;
  }>(sql`
    SELECT status, promoted_person_id, promoted_at
    FROM factsheets WHERE id = ${input.factsheetId}
  `);
  const fs = fsRows[0];
  if (!fs) {
    throw new Error(`unmergeFactsheet: factsheet ${input.factsheetId} not found`);
  }
  if (fs.status !== 'promoted' || !fs.promoted_person_id || !fs.promoted_at) {
    throw new FactsheetNotPromotedError(input.factsheetId);
  }

  const personId = fs.promoted_person_id;
  const promotedAt = fs.promoted_at;

  // Cluster guard FIRST — if it's part of a cluster, no point checking dirtiness.
  // Bundle D Task 9: skipClusterCheck bypasses this guard for the cluster-unmerge
  // outer driver (spec §3.5), which handles cluster-level membership itself.
  if (!input.skipClusterCheck) {
    const membership = await getClusterMembership(db, input.factsheetId);
    if (membership.kind === 'precise') {
      throw new ClusterMemberUseClusterUnmergeError(input.factsheetId, membership.clusterPromotionId);
    }
    if (membership.kind === 'legacy') {
      throw new LegacyClusterNotSupportedError(input.factsheetId);
    }
  }

  if (!input.skipDirtyCheck && await isPersonDirtySincePromote(db, personId, promotedAt)) {
    throw new PersonDirtyError(personId);
  }

  const now = new Date().toISOString();
  const deleted = { persons: 0, events: 0, names: 0, sources: 0, citations: 0 };

  // 1. Find sources to delete via the citations that will be removed. We
  //    capture source IDs BEFORE deleting citations because the citation
  //    row is our only link back to the source.
  //
  //    Inclusive >= is intentional: citations CREATED at promotion are
  //    artifacts of promotion and must be removed. Contrast with the dirty
  //    check above, which uses strict > to allow rows that were created
  //    AT promotion time to count as "not edited since".
  const citationSourceIds = await db.all<{ source_id: string }>(sql`
    SELECT DISTINCT source_id FROM source_citations
    WHERE person_id = ${personId} AND created_at >= ${promotedAt}
  `);

  // 2. Delete citations first (FK dependency: citations → sources).
  const citDel = await db.run(sql`
    DELETE FROM source_citations
    WHERE person_id = ${personId} AND created_at >= ${promotedAt}
  `);
  deleted.citations = readChanges(citDel);

  // 3. Delete the sources that backed those citations — but ONLY if no other
  //    citation still references them. Production schema has ON DELETE CASCADE
  //    from source_citations to sources, so an unguarded DELETE would cascade
  //    and destroy citations belonging to other persons (e.g. a shared census
  //    record cited on two different promoted factsheets). The NOT EXISTS
  //    check is sufficient because step 2 already removed THIS person's
  //    citations — any remaining citations belong to other persons (or
  //    no person at all, person_id IS NULL).
  for (const { source_id } of citationSourceIds) {
    const srcDel = await db.run(sql`
      DELETE FROM sources
      WHERE id = ${source_id}
        AND NOT EXISTS (
          SELECT 1 FROM source_citations
          WHERE source_id = ${source_id}
        )
    `);
    deleted.sources += readChanges(srcDel);
  }

  // 4. Delete events (depends on persons via person_id, but no FK in our
  //    schema; safe to delete before persons).
  const evDel = await db.run(sql`DELETE FROM events WHERE person_id = ${personId}`);
  deleted.events = readChanges(evDel);

  // 5. Delete person_names. CASCADE on persons would also handle this but we
  //    do it explicitly for accurate `deleted.names` count.
  const nameDel = await db.run(sql`DELETE FROM person_names WHERE person_id = ${personId}`);
  deleted.names = readChanges(nameDel);

  // 6. Delete the person row itself.
  const personDel = await db.run(sql`DELETE FROM persons WHERE id = ${personId}`);
  deleted.persons = readChanges(personDel);

  // 7. Unlink research_facts from the now-deleted citations so they revert
  //    to "unsourced" state inside the factsheet.
  await db.run(sql`
    UPDATE research_facts
    SET source_citation_id = NULL, updated_at = ${now}
    WHERE factsheet_id = ${input.factsheetId}
      AND source_citation_id IS NOT NULL
  `);

  // 8. Revert factsheet status back to 'ready' for re-promotion.
  await db.run(sql`
    UPDATE factsheets
    SET status = 'ready',
        promoted_person_id = NULL,
        promoted_at = NULL,
        updated_at = ${now}
    WHERE id = ${input.factsheetId}
  `);

  return { deleted, personId, promotedAt };
}

/**
 * Public wrapper — preserves the original public signature.
 * Opens its own transaction, calls inner, writes audit event, commits.
 *
 * Bundle C Task 5 refactor: extracted `_unmergeFactsheetInTransaction` so the
 * /repromote-force endpoint (Task 8) can compose unmerge+promote inside a
 * single outer transaction. This wrapper's behavior is unchanged.
 */
export async function unmergeFactsheet(
  db: Database,
  input: UnmergeFactsheetInput,
): Promise<UnmergeFactsheetResult> {
  const trimmed = input.reason?.trim() ?? '';
  if (trimmed.length === 0) {
    throw new ReasonRequiredError('unmergeFactsheet', 'reason is required');
  }

  // Explicit BEGIN/COMMIT/ROLLBACK — Drizzle's db.transaction(async tx) breaks
  // on better-sqlite3 (see project memory feedback_drizzle_transactions.md).
  await db.run(sql`BEGIN IMMEDIATE`);
  try {
    const result = await _unmergeFactsheetInTransaction(db, {
      factsheetId: input.factsheetId,
    });

    // Audit log — inside the transaction so row mutations + audit are atomic.
    await logReverseEvent({
      db,
      eventType: 'factsheet_unmerged',
      reason: trimmed,
      actorId: input.actorId,
      threadId: input.threadId ?? null,
      factsheetId: input.factsheetId,
      personId: result.personId,
    });

    await db.run(sql`COMMIT`);
    return { deleted: result.deleted };
  } catch (err) {
    await db.run(sql`ROLLBACK`);
    throw err;
  }
}
