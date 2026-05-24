import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';
import { logReverseEvent } from '../audit/log-reverse-event';

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

export class ClusterPromotedError extends Error {
  constructor(public factsheetId: string) {
    super(
      `Factsheet ${factsheetId} was promoted as part of a cluster. Cluster unmerge is not supported in this release.`,
    );
    this.name = 'ClusterPromotedError';
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
 * Heuristic: a factsheet was cluster-promoted if its promoted person also
 * appears as a partner in a `families` row OR a child in a `children` row
 * whose created_at is within ±5s of the factsheet's promoted_at.
 * See spec §7 — ISO-8601 strings sort lexicographically so SQL BETWEEN works.
 */
export async function isClusterPromoted(
  db: Database,
  factsheetId: string,
): Promise<boolean> {
  const fs = await db.all<{
    promoted_person_id: string | null;
    promoted_at: string | null;
  }>(sql`
    SELECT promoted_person_id, promoted_at
    FROM factsheets WHERE id = ${factsheetId}
  `);
  const row = fs[0];
  if (!row || !row.promoted_person_id || !row.promoted_at) return false;

  const personId = row.promoted_person_id;
  const promotedAt = row.promoted_at;

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

export async function unmergeFactsheet(
  db: Database,
  input: UnmergeFactsheetInput,
): Promise<UnmergeFactsheetResult> {
  const trimmed = input.reason?.trim() ?? '';
  if (trimmed.length === 0) {
    throw new Error('unmergeFactsheet: reason is required');
  }

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
  if (await isClusterPromoted(db, input.factsheetId)) {
    throw new ClusterPromotedError(input.factsheetId);
  }

  if (await isPersonDirtySincePromote(db, personId, promotedAt)) {
    throw new PersonDirtyError(personId);
  }

  const now = new Date().toISOString();
  const deleted = { persons: 0, events: 0, names: 0, sources: 0, citations: 0 };

  // Explicit BEGIN/COMMIT/ROLLBACK — Drizzle's db.transaction(async tx) breaks
  // on better-sqlite3 (see project memory feedback_drizzle_transactions.md).
  await db.run(sql`BEGIN IMMEDIATE`);
  try {
    // 1. Find sources to delete via the citations that will be removed. We
    //    capture source IDs BEFORE deleting citations because the citation
    //    row is our only link back to the source.
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

    // 3. Delete the sources that backed those citations.
    for (const { source_id } of citationSourceIds) {
      const srcDel = await db.run(sql`DELETE FROM sources WHERE id = ${source_id}`);
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

    // 9. Audit log — inside the transaction so row mutations + audit are atomic.
    await logReverseEvent({
      db,
      eventType: 'factsheet_unmerged',
      reason: trimmed,
      actorId: input.actorId,
      threadId: input.threadId ?? null,
      factsheetId: input.factsheetId,
      personId,
    });

    await db.run(sql`COMMIT`);
  } catch (err) {
    await db.run(sql`ROLLBACK`);
    throw err;
  }

  return { deleted };
}
