import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { Database } from '@ancstra/db';

/**
 * Bundle C 2026-05-24 — patch-on-second-promote helpers.
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-c-design.md §2.2, §2.3.
 *
 * - computePatchDiff: pure read; classifies factsheet's accepted facts vs the
 *   existing promoted person's events as added/modified/unchanged.
 * - applyPatchDiff: INSIDE-TRANSACTION writer; caller MUST open BEGIN/COMMIT.
 * - hashPatchDiff: canonical SHA-256 of a diff (stable across array reorderings
 *   of unchanged and delta lists; sensitive to any field value change).
 */

export type FieldDelta = {
  field: 'dateOriginal' | 'dateSort' | 'placeText' | 'description';
  before: unknown;
  after: unknown;
};

export type AddedEvent = {
  eventType: string;
  dateOriginal: string | null;
  dateSort: number | null;
  placeText: string | null;
  description: string | null;
};

export type ModifiedEvent = {
  eventId: string;
  eventType: string;
  deltas: FieldDelta[];
};

export type AddedCitation = {
  researchItemId: string;
  sourceTitle: string;
};

export type PatchDiff = {
  factsheetId: string;
  personId: string;
  events: {
    added: AddedEvent[];
    modified: ModifiedEvent[];
    unchanged: string[];
  };
  citations: {
    added: AddedCitation[];
    unchanged: string[];
  };
};

export class LegacyPromotionNotPatchableError extends Error {
  constructor(public factsheetId: string) {
    super(
      `Factsheet ${factsheetId} was promoted before live-link support (events have no source_factsheet_id). Unmerge and re-promote to enable patching.`,
    );
    this.name = 'LegacyPromotionNotPatchableError';
  }
}

const FACT_TO_EVENT: Record<string, string> = {
  birth_date: 'birth',
  birth_place: 'birth',
  death_date: 'death',
  death_place: 'death',
  marriage_date: 'marriage',
  marriage_place: 'marriage',
  immigration: 'immigration',
  military_service: 'military',
};

interface FactRow {
  id: string;
  fact_type: string;
  fact_value: string;
  fact_date_sort: number | null;
  research_item_id: string | null;
  source_citation_id: string | null;
  confidence: string;
  accepted: number | null;
}

interface EventRow {
  id: string;
  event_type: string;
  date_original: string | null;
  date_sort: number | null;
  place_text: string | null;
  description: string | null;
  source_factsheet_id: string | null;
}

interface FactsheetRow {
  id: string;
  status: string;
  promoted_person_id: string | null;
  promoted_at: string | null;
}

/**
 * Compute the diff between a factsheet's accepted facts and the existing
 * promoted person's events. PURE — no writes.
 *
 * Throws LegacyPromotionNotPatchableError if the promoted person has events
 * with NO source_factsheet_id set (legacy promotion pre-Bundle C) and none
 * of its events are tagged with this factsheetId.
 */
export async function computePatchDiff(
  db: Database,
  factsheetId: string,
): Promise<PatchDiff> {
  const fsRows = await db.all<FactsheetRow>(sql`
    SELECT id, status, promoted_person_id, promoted_at
    FROM factsheets WHERE id = ${factsheetId}
  `);
  const fs = fsRows[0];
  if (!fs) {
    throw new Error(`computePatchDiff: factsheet ${factsheetId} not found`);
  }
  if (fs.status !== 'promoted' || !fs.promoted_person_id) {
    throw new Error(`computePatchDiff: factsheet ${factsheetId} is not promoted`);
  }
  const personId = fs.promoted_person_id;

  // Legacy guard: any events for this person without source_factsheet_id, AND
  // none tagged with our factsheet id → legacy promotion (pre-Bundle C).
  const probeRows = await db.all<{ has_tracked: number | null; has_untracked: number | null }>(sql`
    SELECT
      SUM(CASE WHEN source_factsheet_id = ${factsheetId} THEN 1 ELSE 0 END) AS has_tracked,
      SUM(CASE WHEN source_factsheet_id IS NULL THEN 1 ELSE 0 END) AS has_untracked
    FROM events WHERE person_id = ${personId}
  `);
  const probe = probeRows[0];
  if (
    probe &&
    Number(probe.has_tracked ?? 0) === 0 &&
    Number(probe.has_untracked ?? 0) > 0
  ) {
    throw new LegacyPromotionNotPatchableError(factsheetId);
  }

  const facts = await db.all<FactRow>(sql`
    SELECT id, fact_type, fact_value, fact_date_sort, research_item_id,
           source_citation_id, confidence, accepted
    FROM research_facts
    WHERE factsheet_id = ${factsheetId}
      AND (accepted IS NULL OR accepted = 1)
    ORDER BY fact_type
  `);

  const existingEvents = await db.all<EventRow>(sql`
    SELECT id, event_type, date_original, date_sort, place_text, description,
           source_factsheet_id
    FROM events
    WHERE person_id = ${personId} AND source_factsheet_id = ${factsheetId}
  `);
  const existingByType = new Map<string, EventRow>();
  for (const ev of existingEvents) existingByType.set(ev.event_type, ev);

  // Group facts into event shapes (mirrors promoteSingleFactsheet logic).
  type Group = {
    dateOriginal: string | null;
    dateSort: number | null;
    placeText: string | null;
  };
  const groups = new Map<string, Group>();
  for (const fact of facts) {
    const eventType = FACT_TO_EVENT[fact.fact_type];
    if (!eventType) continue;
    const group =
      groups.get(eventType) ?? { dateOriginal: null, dateSort: null, placeText: null };
    if (fact.fact_type.endsWith('_date')) {
      group.dateOriginal = fact.fact_value;
      group.dateSort = fact.fact_date_sort;
    } else if (fact.fact_type.endsWith('_place')) {
      group.placeText = fact.fact_value;
    }
    groups.set(eventType, group);
  }

  const added: AddedEvent[] = [];
  const modified: ModifiedEvent[] = [];
  const unchanged: string[] = [];

  for (const [eventType, group] of groups) {
    const existing = existingByType.get(eventType);
    if (!existing) {
      added.push({
        eventType,
        dateOriginal: group.dateOriginal,
        dateSort: group.dateSort,
        placeText: group.placeText,
        description: null,
      });
      continue;
    }
    const deltas: FieldDelta[] = [];
    if (existing.date_original !== group.dateOriginal) {
      deltas.push({
        field: 'dateOriginal',
        before: existing.date_original,
        after: group.dateOriginal,
      });
    }
    if (existing.date_sort !== group.dateSort) {
      deltas.push({
        field: 'dateSort',
        before: existing.date_sort,
        after: group.dateSort,
      });
    }
    if (existing.place_text !== group.placeText) {
      deltas.push({
        field: 'placeText',
        before: existing.place_text,
        after: group.placeText,
      });
    }
    if (deltas.length > 0) {
      modified.push({ eventId: existing.id, eventType, deltas });
    } else {
      unchanged.push(existing.id);
    }
  }

  // Citations: linked-via-fact = unchanged; new research_items = added.
  const researchItemIds = [
    ...new Set(
      facts.filter((f) => f.research_item_id !== null).map((f) => f.research_item_id!),
    ),
  ];
  const addedCitations: AddedCitation[] = [];
  const unchangedCitations: string[] = [];
  for (const riId of researchItemIds) {
    const linked = facts.find(
      (f) => f.research_item_id === riId && f.source_citation_id !== null,
    );
    if (linked && linked.source_citation_id) {
      unchangedCitations.push(linked.source_citation_id);
    } else {
      const titleRows = await db.all<{ title: string }>(sql`
        SELECT title FROM research_items WHERE id = ${riId}
      `);
      const titleRow = titleRows[0];
      addedCitations.push({
        researchItemId: riId,
        sourceTitle: titleRow?.title ?? '(untitled)',
      });
    }
  }

  return {
    factsheetId,
    personId,
    events: { added, modified, unchanged },
    citations: { added: addedCitations, unchanged: unchangedCitations },
  };
}

/**
 * Apply a precomputed diff INSIDE an already-open transaction.
 * Caller MUST have already run `BEGIN IMMEDIATE` (or `BEGIN`); this function
 * does not open or close a transaction. Returns counts of writes performed.
 */
export async function applyPatchDiff(
  db: Database,
  diff: PatchDiff,
  ctx: { actorId: string; now?: string },
): Promise<{ eventsAdded: number; eventsModified: number; citationsAdded: number }> {
  const now = ctx.now ?? new Date().toISOString();
  let eventsAdded = 0;
  let eventsModified = 0;
  let citationsAdded = 0;

  for (const ev of diff.events.added) {
    const newId = crypto.randomUUID();
    await db.run(sql`
      INSERT INTO events (
        id, event_type, person_id, source_factsheet_id,
        date_original, date_sort, place_text, description,
        created_at, updated_at
      )
      VALUES (
        ${newId}, ${ev.eventType}, ${diff.personId}, ${diff.factsheetId},
        ${ev.dateOriginal}, ${ev.dateSort}, ${ev.placeText}, ${ev.description},
        ${now}, ${now}
      )
    `);
    eventsAdded++;
  }

  // Per-delta UPDATEs (avoids dynamic SET clause complexity).
  for (const ev of diff.events.modified) {
    for (const delta of ev.deltas) {
      if (delta.field === 'dateOriginal') {
        await db.run(sql`
          UPDATE events
          SET date_original = ${delta.after as string | null}, updated_at = ${now}
          WHERE id = ${ev.eventId}
        `);
      } else if (delta.field === 'dateSort') {
        await db.run(sql`
          UPDATE events
          SET date_sort = ${delta.after as number | null}, updated_at = ${now}
          WHERE id = ${ev.eventId}
        `);
      } else if (delta.field === 'placeText') {
        await db.run(sql`
          UPDATE events
          SET place_text = ${delta.after as string | null}, updated_at = ${now}
          WHERE id = ${ev.eventId}
        `);
      } else if (delta.field === 'description') {
        await db.run(sql`
          UPDATE events
          SET description = ${delta.after as string | null}, updated_at = ${now}
          WHERE id = ${ev.eventId}
        `);
      }
    }
    eventsModified++;
  }

  for (const cit of diff.citations.added) {
    const itemRows = await db.all<{ title: string; url: string | null }>(sql`
      SELECT title, url FROM research_items WHERE id = ${cit.researchItemId}
    `);
    const item = itemRows[0];
    if (!item) continue;
    const sourceId = crypto.randomUUID();
    const citationId = crypto.randomUUID();
    await db.run(sql`
      INSERT INTO sources (
        id, title, repository_url, source_type, created_by, created_at, updated_at
      )
      VALUES (
        ${sourceId}, ${item.title}, ${item.url}, 'online',
        ${ctx.actorId}, ${now}, ${now}
      )
    `);
    await db.run(sql`
      INSERT INTO source_citations (
        id, source_id, person_id, confidence, created_at
      )
      VALUES (
        ${citationId}, ${sourceId}, ${diff.personId}, 'medium', ${now}
      )
    `);
    await db.run(sql`
      UPDATE research_facts
      SET source_citation_id = ${citationId}, updated_at = ${now}
      WHERE factsheet_id = ${diff.factsheetId}
        AND research_item_id = ${cit.researchItemId}
    `);
    citationsAdded++;
  }

  await db.run(sql`
    UPDATE factsheets
    SET promoted_at = ${now}, updated_at = ${now}
    WHERE id = ${diff.factsheetId}
  `);

  return { eventsAdded, eventsModified, citationsAdded };
}

/**
 * Canonical SHA-256 hash of a PatchDiff. Stable across input orderings of
 * `unchanged` arrays and `deltas` arrays within a modified event; sensitive
 * to any field-value change in added/modified entries or top-level ids.
 * See spec §2.3.
 */
export function hashPatchDiff(diff: PatchDiff): string {
  const canonical = {
    factsheetId: diff.factsheetId,
    personId: diff.personId,
    events: {
      added: diff.events.added,
      modified: diff.events.modified.map((m) => ({
        eventId: m.eventId,
        eventType: m.eventType,
        deltas: [...m.deltas].sort((a, b) => a.field.localeCompare(b.field)),
      })),
      unchanged: [...diff.events.unchanged].sort(),
    },
    citations: {
      added: diff.citations.added,
      unchanged: [...diff.citations.unchanged].sort(),
    },
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
