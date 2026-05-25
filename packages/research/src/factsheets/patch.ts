import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { Database } from '@ancstra/db';
import { FactsheetNotPromotedError } from './unmerge';

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
  field: 'dateOriginal' | 'dateSort' | 'placeText';
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
      `Factsheet ${factsheetId} cannot be patched: person has events without source_factsheet_id (legacy promotion or manually-created events). Unmerge and re-promote, or detach the live link, to resolve.`,
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
 * Throws LegacyPromotionNotPatchableError if the promoted person has ANY
 * events without source_factsheet_id — whether pure legacy (all untracked)
 * or mixed (some tracked + some manually-added). Patching a mixed person
 * would silently duplicate/diverge from the untracked rows.
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
    throw new FactsheetNotPromotedError(factsheetId);
  }
  const personId = fs.promoted_person_id;

  // Legacy/mixed-state guard: refuse whenever ANY events on the person lack a
  // source_factsheet_id. This covers both pure legacy promotions (all
  // untracked) and mixed states where a user added events manually after a
  // Bundle C promote. Patching in either case would leave the untracked rows
  // in place and silently duplicate/diverge from them.
  const probeRows = await db.all<{ has_untracked: number | null }>(sql`
    SELECT
      SUM(CASE WHEN source_factsheet_id IS NULL THEN 1 ELSE 0 END) AS has_untracked
    FROM events WHERE person_id = ${personId}
  `);
  const probe = probeRows[0];
  if (probe && Number(probe.has_untracked ?? 0) > 0) {
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
    // Silent-retain semantics: a null group value means "factsheet is silent on
    // this field" (e.g. AI surfaced birth_date but no birth_place). Treat that
    // as retain-existing rather than as an assertion of null — otherwise a
    // silent factsheet would clear existing event data. Only an explicit
    // non-null factsheet value (that differs) produces a delta.
    if (group.dateOriginal !== null && existing.date_original !== group.dateOriginal) {
      deltas.push({
        field: 'dateOriginal',
        before: existing.date_original,
        after: group.dateOriginal,
      });
    }
    if (group.dateSort !== null && existing.date_sort !== group.dateSort) {
      deltas.push({
        field: 'dateSort',
        before: existing.date_sort,
        after: group.dateSort,
      });
    }
    if (group.placeText !== null && existing.place_text !== group.placeText) {
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

// ---------------------------------------------------------------------------
// Pending edge changes (Bundle D 2026-05-25)
// See: docs/superpowers/specs/2026-05-25-research-flow-unification-bundle-d-design.md §3.2
// ---------------------------------------------------------------------------

export type PendingEdgeChange = {
  fromFactsheetId: string;
  toFactsheetId: string;
  relationshipType: 'spouse' | 'parent_child';
};

export type PendingEdgeChanges = {
  added: PendingEdgeChange[];
  removed: PendingEdgeChange[];
};

interface FactsheetLinkRow {
  from_factsheet_id: string;
  to_factsheet_id: string;
  relationship_type: string;
}

interface FactsheetMemberRow {
  id: string;
  promoted_person_id: string | null;
  cluster_promotion_id: string | null;
}

interface FamilyRow {
  partner1_id: string | null;
  partner2_id: string | null;
}

interface ChildRow {
  person_id: string;
  family_id: string;
}

interface FamilyPersonRow {
  person_id: string | null;
}

/**
 * Approximate diff of `factsheet_links` for the cluster vs the currently-promoted
 * families/children graph. PURE — no writes.
 *
 * "added"   = link in factsheet_links for cluster members whose corresponding
 *             families/children row is missing.
 * "removed" = families/children row referencing cluster members whose
 *             corresponding link is missing.
 *
 * Approximate by design (spec §3.2) — informational-only, never authoritative.
 * Returns `{ added: [], removed: [] }` when there is no edge drift.
 *
 * Caller must pass the `clusterPromotionId` (resolved by `getClusterMembership`
 * before calling this function — no redundant DB fetch here).
 */
export async function computePendingEdgeChanges(
  db: Database,
  clusterPromotionId: string,
): Promise<PendingEdgeChanges> {
  // 1. Resolve all cluster member factsheets + their promoted person IDs.
  const memberRows = await db.all<FactsheetMemberRow>(sql`
    SELECT id, promoted_person_id, cluster_promotion_id
    FROM factsheets
    WHERE cluster_promotion_id = ${clusterPromotionId}
      AND promoted_person_id IS NOT NULL
  `);
  if (memberRows.length === 0) return { added: [], removed: [] };

  // Build cross-reference maps.
  const factsheetToPersonId = new Map<string, string>();
  const personToFactsheetId = new Map<string, string>();
  for (const row of memberRows) {
    if (row.promoted_person_id) {
      factsheetToPersonId.set(row.id, row.promoted_person_id);
      personToFactsheetId.set(row.promoted_person_id, row.id);
    }
  }

  const memberFactsheetIds = memberRows.map((r) => r.id);
  const memberPersonIds = [...personToFactsheetId.keys()];

  // 2. Fetch current factsheet_links between cluster members.
  //    Only links where BOTH endpoints are cluster members are relevant for
  //    edge-drift detection (cross-cluster or external links are out of scope).
  const fsIdsSql = sql.join(memberFactsheetIds.map((id) => sql`${id}`), sql`, `);
  const linkRows = await db.all<FactsheetLinkRow>(sql`
    SELECT from_factsheet_id, to_factsheet_id, relationship_type
    FROM factsheet_links
    WHERE from_factsheet_id IN (${fsIdsSql})
      AND to_factsheet_id IN (${fsIdsSql})
  `);

  // Normalise to only 'spouse' and 'parent_child' (those are the only two
  // relationship types that map directly to families/children rows).
  const relevantLinks = linkRows.filter(
    (l) => l.relationship_type === 'spouse' || l.relationship_type === 'parent_child',
  );

  // 3. Fetch current families rows for cluster members.
  const personIdsSql = sql.join(memberPersonIds.map((id) => sql`${id}`), sql`, `);
  const familyRows = await db.all<FamilyRow>(sql`
    SELECT partner1_id, partner2_id FROM families
    WHERE (partner1_id IN (${personIdsSql}) OR partner2_id IN (${personIdsSql}))
      AND deleted_at IS NULL
  `);

  // 4. Fetch children rows for cluster member persons.
  //    We need the family_id to cross-check which families we already have.
  const childRows = await db.all<ChildRow>(sql`
    SELECT person_id, family_id FROM children
    WHERE person_id IN (${personIdsSql})
  `);

  // For parent_child detection we need to know which persons are parents in
  // each family row (partner1/partner2 are the parents).
  // Build a set of "parent person IDs" per family_id for the children we have.
  const familyParentPersonIds = new Map<string, string[]>();
  for (const f of familyRows) {
    // We need family id — re-query to get ids.
  }
  // Re-fetch families with their IDs so we can correlate with children.
  const familyIdRows = await db.all<{ id: string; partner1_id: string | null; partner2_id: string | null }>(sql`
    SELECT id, partner1_id, partner2_id FROM families
    WHERE (partner1_id IN (${personIdsSql}) OR partner2_id IN (${personIdsSql}))
      AND deleted_at IS NULL
  `);
  for (const f of familyIdRows) {
    familyParentPersonIds.set(f.id, [f.partner1_id, f.partner2_id].filter(Boolean) as string[]);
  }

  // ---------------------------------------------------------------------------
  // 5. Build "edge keys" for the factsheet_links side.
  //    Key format: `${fromFs}::${toFs}::${type}` (canonical — from < to for
  //    spouse links which are inherently symmetric; parent_child is directed).
  // ---------------------------------------------------------------------------

  function linkKey(fromFs: string, toFs: string, type: 'spouse' | 'parent_child'): string {
    if (type === 'spouse') {
      const [a, b] = [fromFs, toFs].sort();
      return `${a}::${b}::spouse`;
    }
    return `${fromFs}::${toFs}::parent_child`;
  }

  const linkEdgeKeys = new Set<string>();
  const linkEdgeByKey = new Map<string, PendingEdgeChange>();
  for (const l of relevantLinks) {
    const type = l.relationship_type as 'spouse' | 'parent_child';
    const k = linkKey(l.from_factsheet_id, l.to_factsheet_id, type);
    linkEdgeKeys.add(k);
    linkEdgeByKey.set(k, {
      fromFactsheetId: l.from_factsheet_id,
      toFactsheetId: l.to_factsheet_id,
      relationshipType: type,
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Build "edge keys" for the families/children side.
  //    spouse edge: family with two cluster-member partners.
  //    parent_child edge: child row whose family has a cluster-member parent.
  // ---------------------------------------------------------------------------

  const familyEdgeKeys = new Set<string>();
  const familyEdgeByKey = new Map<string, PendingEdgeChange>();

  for (const fam of familyIdRows) {
    const p1Fs = fam.partner1_id ? personToFactsheetId.get(fam.partner1_id) : undefined;
    const p2Fs = fam.partner2_id ? personToFactsheetId.get(fam.partner2_id) : undefined;

    if (p1Fs && p2Fs) {
      // Both partners are cluster members → spouse edge.
      const k = linkKey(p1Fs, p2Fs, 'spouse');
      familyEdgeKeys.add(k);
      familyEdgeByKey.set(k, {
        fromFactsheetId: p1Fs,
        toFactsheetId: p2Fs,
        relationshipType: 'spouse',
      });
    }
  }

  for (const child of childRows) {
    const childFs = personToFactsheetId.get(child.person_id);
    if (!childFs) continue;
    const parents = familyParentPersonIds.get(child.family_id) ?? [];
    for (const parentPersonId of parents) {
      const parentFs = personToFactsheetId.get(parentPersonId);
      if (!parentFs) continue;
      // parent → child direction
      const k = linkKey(parentFs, childFs, 'parent_child');
      familyEdgeKeys.add(k);
      familyEdgeByKey.set(k, {
        fromFactsheetId: parentFs,
        toFactsheetId: childFs,
        relationshipType: 'parent_child',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Diff.
  //    added   = in linkEdgeKeys but NOT in familyEdgeKeys
  //    removed = in familyEdgeKeys but NOT in linkEdgeKeys
  // ---------------------------------------------------------------------------

  const added: PendingEdgeChange[] = [];
  for (const [k, edge] of linkEdgeByKey) {
    if (!familyEdgeKeys.has(k)) added.push(edge);
  }

  const removed: PendingEdgeChange[] = [];
  for (const [k, edge] of familyEdgeByKey) {
    if (!linkEdgeKeys.has(k)) removed.push(edge);
  }

  return { added, removed };
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
