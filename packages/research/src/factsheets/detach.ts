import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';
import { logReverseEvent } from '../audit/log-reverse-event';
import { ReasonRequiredError } from '../audit/reason';
import { FactsheetNotPromotedError, ClusterPromotedError, isClusterPromoted } from './unmerge';

/**
 * Bundle C 2026-05-24 — soft-detach a promoted factsheet.
 * Clears promoted_person_id + promoted_at, sets status=ready, leaves person
 * and all events/citations untouched. Re-promoting later creates a fresh person
 * (no re-link path — out of scope per spec §9).
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-c-design.md §2.1.2
 */

export interface SoftDetachInput {
  factsheetId: string;
  reason: string;
  actorId: string;
  threadId?: string | null;
}

export interface SoftDetachResult {
  factsheetId: string;
  previousPersonId: string;
}

export async function softDetachFactsheet(
  db: Database,
  input: SoftDetachInput,
): Promise<SoftDetachResult> {
  const trimmed = input.reason?.trim() ?? '';
  if (trimmed.length === 0) {
    throw new ReasonRequiredError('softDetachFactsheet', 'reason is required');
  }

  const fsRows = await db.all<{ status: string; promoted_person_id: string | null; promoted_at: string | null }>(sql`
    SELECT status, promoted_person_id, promoted_at
    FROM factsheets WHERE id = ${input.factsheetId}
  `);
  const fs = fsRows[0];
  if (!fs) throw new Error(`softDetachFactsheet: factsheet ${input.factsheetId} not found`);
  if (fs.status !== 'promoted' || !fs.promoted_person_id) {
    throw new FactsheetNotPromotedError(input.factsheetId);
  }

  if (await isClusterPromoted(db, input.factsheetId)) {
    throw new ClusterPromotedError(input.factsheetId);
  }

  const previousPersonId = fs.promoted_person_id;
  const now = new Date().toISOString();

  await db.run(sql`BEGIN IMMEDIATE`);
  try {
    await db.run(sql`
      UPDATE factsheets
      SET status = 'ready',
          promoted_person_id = NULL,
          promoted_at = NULL,
          updated_at = ${now}
      WHERE id = ${input.factsheetId}
    `);

    // NOTE per spec §2.1.2: leave events.source_factsheet_id set so the
    // historical audit trail still shows which events came from which
    // (now-detached) factsheet.

    await logReverseEvent({
      db,
      eventType: 'factsheet_detached',
      reason: trimmed,
      actorId: input.actorId,
      threadId: input.threadId ?? null,
      factsheetId: input.factsheetId,
      personId: previousPersonId,
      payload: { previousPersonId },
    });

    await db.run(sql`COMMIT`);
  } catch (err) {
    await db.run(sql`ROLLBACK`);
    throw err;
  }

  return { factsheetId: input.factsheetId, previousPersonId };
}
