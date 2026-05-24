import { eq, sql } from 'drizzle-orm';
import {
  factsheets,
  factsheetLinks,
  researchFacts,
  researchItems,
  persons,
  personNames,
  events,
  families,
  children,
  sources,
  sourceCitations,
  refreshSummary,
} from '@ancstra/db';
import type { Database } from '@ancstra/db';
import { isFactsheetPromotable } from './validation';
import { getFactsheetCluster } from './links';
import { addEvent } from '../threads/events';

export interface PromoteSingleInput {
  factsheetId: string;
  mode: 'create' | 'merge';
  mergeTargetPersonId?: string;
  userId: string;
  /** Skip promotability validation for programmatic callers. */
  skipValidation?: boolean;
  /** When set, emits a 'factsheet_promoted' thread event after success. */
  threadId?: string | null;
}

export interface PromoteSingleResult {
  personId: string;
  eventsCreated: number;
  sourcesCreated: number;
  mode: 'created' | 'merged';
}

export interface PromoteClusterResult {
  personsCreated: number;
  familiesCreated: number;
  childLinksCreated: number;
  results: PromoteSingleResult[];
}

/** Map fact types to event types for event creation. */
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

/**
 * Inner transaction body for single-factsheet promote. Caller MUST have
 * opened a transaction; responsible for COMMIT/ROLLBACK.
 *
 * Used by:
 *   - public `promoteSingleFactsheet` (wraps with own transaction)
 *   - /repromote-force endpoint (one outer transaction wraps unmerge+promote)
 *
 * Behavior is identical to the previous inline body with one exception:
 *   - The events INSERT now sets `sourceFactsheetId` (Bundle C Task 1 added
 *     the column; this task populates it on every first-promote so we can
 *     later surface "promoted from factsheet X" + drive force-repromote).
 *
 * Does NOT call `refreshSummary` or emit thread events — those live in the
 * public wrapper so /repromote-force can choose when to fire them after the
 * combined outer transaction commits.
 *
 * The `now` ISO timestamp is threaded from the caller so unmerge + promote
 * inside the same outer transaction share a consistent timestamp.
 */
export async function _promoteSingleFactsheetInTransaction(
  db: Database,
  input: PromoteSingleInput,
  now: string,
): Promise<PromoteSingleResult> {
  const mode = input.mode;
  let personId: string;
  let eventsCreated = 0;
  let sourcesCreated = 0;

  // Get accepted/unresolved facts (skip rejected)
  const facts = await db.all<{
    id: string;
    factType: string;
    factValue: string;
    factDateSort: number | null;
    researchItemId: string | null;
    confidence: string;
    accepted: number | null;
  }>(sql`
    SELECT id, fact_type as factType, fact_value as factValue,
           fact_date_sort as factDateSort, research_item_id as researchItemId,
           confidence, accepted
    FROM research_facts
    WHERE factsheet_id = ${input.factsheetId}
      AND (accepted IS NULL OR accepted = 1)
    ORDER BY fact_type
  `);

  if (mode === 'create') {
    // Extract name and sex from facts
    const nameFact = facts.find(f => f.factType === 'name');
    const nameParts = (nameFact?.factValue ?? 'Unknown').split(' ');
    const givenName = nameParts[0] ?? 'Unknown';
    const surname = nameParts.slice(1).join(' ') || '';

    personId = crypto.randomUUID();

    await db.insert(persons)
      .values({
        id: personId,
        sex: 'U',
        isLiving: false,
        privacyLevel: 'public',
        createdBy: input.userId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db.insert(personNames)
      .values({
        id: crypto.randomUUID(),
        personId,
        nameType: 'birth',
        givenName,
        surname,
        isPrimary: true,
        createdAt: now,
      })
      .run();
  } else {
    personId = input.mergeTargetPersonId!;
  }

  // Create events from date/place facts
  const eventGroups = new Map<string, { date?: string; place?: string; dateFact?: typeof facts[0]; placeFact?: typeof facts[0] }>();

  for (const fact of facts) {
    const eventType = FACT_TO_EVENT[fact.factType];
    if (!eventType) continue;

    const group = eventGroups.get(eventType) ?? {};
    if (fact.factType.endsWith('_date')) {
      group.date = fact.factValue;
      group.dateFact = fact;
    } else if (fact.factType.endsWith('_place')) {
      group.place = fact.factValue;
      group.placeFact = fact;
    }
    eventGroups.set(eventType, group);
  }

  for (const [eventType, group] of eventGroups) {
    const eventId = crypto.randomUUID();
    await db.insert(events)
      .values({
        id: eventId,
        personId,
        eventType: eventType as any,
        // Bundle C Task 5: stamp source factsheet on every promotion-created
        // event (both create + merge modes) so /repromote-force can attribute
        // and so the UI can surface "promoted from factsheet X".
        sourceFactsheetId: input.factsheetId,
        dateOriginal: group.date ?? null,
        dateSort: group.dateFact?.factDateSort ?? null,
        placeText: group.place ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    eventsCreated++;
  }

  // Create source + citations from linked research items
  const researchItemIds = [...new Set(facts.filter(f => f.researchItemId).map(f => f.researchItemId!))];

  for (const riId of researchItemIds) {
    const items = await db.select().from(researchItems).where(eq(researchItems.id, riId)).all();
    const item = items[0];
    if (!item) continue;

    const sourceId = crypto.randomUUID();
    const citationId = crypto.randomUUID();

    await db.insert(sources)
      .values({
        id: sourceId,
        title: item.title,
        repositoryUrl: item.url ?? null,
        sourceType: 'online' as any,
        createdBy: input.userId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db.insert(sourceCitations)
      .values({
        id: citationId,
        sourceId,
        personId,
        confidence: 'medium',
        createdAt: now,
      })
      .run();

    // Link facts to citation
    await db.run(sql`
      UPDATE research_facts
      SET source_citation_id = ${citationId}, updated_at = ${now}
      WHERE factsheet_id = ${input.factsheetId}
        AND research_item_id = ${riId}
    `);

    sourcesCreated++;
  }

  // Update factsheet status
  await db.update(factsheets)
    .set({
      status: (mode === 'create' ? 'promoted' : 'merged') as any,
      promotedPersonId: personId,
      promotedAt: now,
      updatedAt: now,
    })
    .where(eq(factsheets.id, input.factsheetId))
    .run();

  return {
    personId,
    eventsCreated,
    sourcesCreated,
    mode: mode === 'create' ? 'created' : 'merged',
  };
}

/**
 * Promote a single factsheet to a person.
 * Mode 'create': creates a new person from the factsheet's facts.
 * Mode 'merge': adds new facts/events to an existing person.
 *
 * Bundle C Task 5 refactor: extracted `_promoteSingleFactsheetInTransaction`
 * so /repromote-force can compose unmerge+promote in one outer transaction.
 * The public signature and behavior of this wrapper are unchanged.
 */
export async function promoteSingleFactsheet(
  db: Database,
  input: PromoteSingleInput,
): Promise<PromoteSingleResult> {
  // Validate promotability (skip when caller has already validated)
  if (!input.skipValidation) {
    const check = await isFactsheetPromotable(db, input.factsheetId);
    if (!check.promotable) {
      throw new Error(`Factsheet not promotable: ${check.blockers.join(', ')}`);
    }
  }

  if (input.mode === 'merge' && !input.mergeTargetPersonId) {
    throw new Error('mergeTargetPersonId required for merge mode');
  }

  // Fetch factsheet title once (needed for the thread event after success).
  const fsRows = await db.all<{ title: string }>(sql`
    SELECT title FROM factsheets WHERE id = ${input.factsheetId}
  `);
  const factsheetTitle = fsRows[0]?.title ?? input.factsheetId;

  const now = new Date().toISOString();
  let result: PromoteSingleResult;

  // Use explicit BEGIN/COMMIT/ROLLBACK — Drizzle's db.transaction(async tx)
  // breaks on better-sqlite3 (see project memory feedback_drizzle_transactions).
  await db.run(sql`BEGIN`);
  try {
    result = await _promoteSingleFactsheetInTransaction(db, input, now);
    await db.run(sql`COMMIT`);
  } catch (err) {
    await db.run(sql`ROLLBACK`);
    throw err;
  }

  // Promotion creates/updates events + source_citations for this person, so
  // person_summary needs a refresh to reflect the new facets (has_source,
  // sources_count, completeness, dates/places).
  await refreshSummary(db, result.personId);

  // Emit thread event when a research thread is active. Fire-and-forget:
  // emission failure must never roll back a successful promotion.
  if (input.threadId) {
    try {
      await addEvent(db, {
        threadId: input.threadId,
        eventType: 'factsheet_promoted',
        actorId: input.userId,
        factsheetId: input.factsheetId,
        personId: result.personId,
        reason: `Promoted "${factsheetTitle}" to person`,
      });
    } catch (err) {
      console.warn('[promoteSingleFactsheet] thread event emission failed:', err);
    }
  }

  return result;
}

/**
 * Promote a cluster of linked factsheets as a family unit.
 * Creates persons for each factsheet, then wires relationships
 * based on factsheet_links.
 */
export async function promoteFactsheetCluster(
  db: Database,
  rootFactsheetId: string,
  userId: string,
  threadId?: string | null,
): Promise<PromoteClusterResult> {
  const clusterIds = await getFactsheetCluster(db, rootFactsheetId);
  const results: PromoteSingleResult[] = [];
  let familiesCreated = 0;
  let childLinksCreated = 0;

  // Phase 1: Promote each factsheet individually
  const factsheetToPersonId = new Map<string, string>();

  for (const fsId of clusterIds) {
    const result = await promoteSingleFactsheet(db, {
      factsheetId: fsId,
      mode: 'create',
      userId,
      threadId,
    });
    factsheetToPersonId.set(fsId, result.personId);
    results.push(result);
  }

  // Phase 2: Wire relationships from links — raw BEGIN/COMMIT/ROLLBACK to
  // stay compatible with better-sqlite3 (project memory feedback_drizzle_transactions).
  const now = new Date().toISOString();
  await db.run(sql`BEGIN`);
  try {
    for (const fsId of clusterIds) {
      const links = await db.select()
        .from(factsheetLinks)
        .where(eq(factsheetLinks.fromFactsheetId, fsId))
        .all();

      for (const link of links) {
        const fromPersonId = factsheetToPersonId.get(link.fromFactsheetId);
        const toPersonId = factsheetToPersonId.get(link.toFactsheetId);
        if (!fromPersonId || !toPersonId) continue;

        if (link.relationshipType === 'spouse') {
          const familyId = crypto.randomUUID();
          await db.insert(families)
            .values({
              id: familyId,
              partner1Id: fromPersonId,
              partner2Id: toPersonId,
              relationshipType: 'unknown',
              validationStatus: 'confirmed',
              createdAt: now,
              updatedAt: now,
            })
            .run();
          familiesCreated++;
        } else if (link.relationshipType === 'parent_child') {
          // from=parent, to=child — find or create family for parent
          const existingFamilies = await db.all(sql`
            SELECT id FROM families
            WHERE partner1_id = ${fromPersonId} OR partner2_id = ${fromPersonId}
            LIMIT 1
          `);

          let familyId: string;
          if (existingFamilies.length > 0) {
            familyId = (existingFamilies[0] as any).id;
          } else {
            familyId = crypto.randomUUID();
            await db.insert(families)
              .values({
                id: familyId,
                partner1Id: fromPersonId,
                relationshipType: 'unknown',
                validationStatus: 'confirmed',
                createdAt: now,
                updatedAt: now,
              })
              .run();
            familiesCreated++;
          }

          await db.insert(children)
            .values({
              id: crypto.randomUUID(),
              familyId,
              personId: toPersonId,
              relationshipToParent1: 'biological',
              createdAt: now,
            })
            .run();
          childLinksCreated++;
        }
      }
    }
    await db.run(sql`COMMIT`);
  } catch (err) {
    await db.run(sql`ROLLBACK`);
    throw err;
  }

  return {
    personsCreated: results.length,
    familiesCreated,
    childLinksCreated,
    results,
  };
}
