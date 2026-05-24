import { researchThreadEvents } from '@ancstra/db';
import type { Database } from '@ancstra/db';

/**
 * Bundle B 2026-05-24 — audit writer for STR-3 reverse transitions.
 * Inserts into the unified research_thread_events log; thread_id may be null
 * for Inbox-context reversals not tied to an active thread.
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-b-design.md §6.2
 */

export type ReverseEventType =
  | 'factsheet_unmerged'
  | 'factsheet_restored'
  | 'fact_unaccepted'
  | 'fact_unrejected'
  | 'hint_reset'
  | 'gedcom_disputed';

export interface ReverseEventInput {
  db: Database;
  eventType: ReverseEventType;
  reason: string;
  actorId: string;
  threadId?: string | null;
  factsheetId?: string | null;
  personId?: string | null;
  researchItemId?: string | null;
  researchFactId?: string | null;
  linkId?: string | null;
  payload?: Record<string, unknown> | null;
}

export async function logReverseEvent(input: ReverseEventInput): Promise<string> {
  const trimmed = input.reason?.trim() ?? '';
  if (trimmed.length === 0) {
    throw new Error('logReverseEvent: reason is required');
  }
  const id = crypto.randomUUID();
  await input.db.insert(researchThreadEvents).values({
    id,
    threadId: input.threadId ?? null,
    eventType: input.eventType,
    actorId: input.actorId,
    factsheetId: input.factsheetId ?? null,
    personId: input.personId ?? null,
    researchItemId: input.researchItemId ?? null,
    researchFactId: input.researchFactId ?? null,
    linkId: input.linkId ?? null,
    reason: trimmed,
    payloadJson: input.payload ? JSON.stringify(input.payload) : null,
    occurredAt: new Date().toISOString(),
  }).run();
  return id;
}
