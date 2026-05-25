import { eq, sql } from 'drizzle-orm';
import {
  researchItems,
  persons,
  personNames,
  events,
  sources,
  sourceCitations,
} from '@ancstra/db';
import type { Database } from '@ancstra/db';

/**
 * Bundle D Task 8 (2026-05-25): private helpers extracted from
 * `_promoteSingleFactsheetInTransaction` so the surgical-swap path used by
 * `/repromote-force` (Task 11) can reuse the data-creation logic without
 * duplicating it.
 *
 * BOTH helpers:
 *   - MUST be called inside an open transaction. They never BEGIN/COMMIT.
 *   - Are intentionally NOT exported from the package barrel — internal to
 *     `factsheets/` only.
 *
 * Behavior is identical to the previous inline body of
 * `_promoteSingleFactsheetInTransaction` (Bundle C). Existing tests are the
 * regression suite.
 */

/** Map fact types to event types for event creation. Private module-level. */
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

/** Shape of an accepted research_fact row used by both helpers. */
interface AcceptedFact {
  id: string;
  factType: string;
  factValue: string;
  factDateSort: number | null;
  researchItemId: string | null;
  confidence: string;
  accepted: number | null;
}

async function selectAcceptedFacts(
  db: Database,
  factsheetId: string,
): Promise<AcceptedFact[]> {
  // Accepted or unresolved facts only (skip rejected). Identical query to the
  // one previously inlined in `_promoteSingleFactsheetInTransaction`.
  return db.all<AcceptedFact>(sql`
    SELECT id, fact_type as factType, fact_value as factValue,
           fact_date_sort as factDateSort, research_item_id as researchItemId,
           confidence, accepted
    FROM research_facts
    WHERE factsheet_id = ${factsheetId}
      AND (accepted IS NULL OR accepted = 1)
    ORDER BY fact_type
  `);
}

/**
 * Phase 1: create a `persons` row + primary `person_names` row from the
 * factsheet's accepted 'name' fact. Does NOT touch factsheets, events,
 * sources, source_citations, or any evidence tables.
 *
 * Caller must be inside an open transaction.
 *
 * Returns the new person's id.
 */
export async function _createPersonFromFactsheet(
  db: Database,
  factsheetId: string,
  userId: string,
  now: string,
): Promise<string> {
  const facts = await selectAcceptedFacts(db, factsheetId);

  // Extract name from facts. Identical fallback ('Unknown') behavior to the
  // previous inline implementation.
  const nameFact = facts.find(f => f.factType === 'name');
  const nameParts = (nameFact?.factValue ?? 'Unknown').split(' ');
  const givenName = nameParts[0] ?? 'Unknown';
  const surname = nameParts.slice(1).join(' ') || '';

  const personId = crypto.randomUUID();

  await db.insert(persons)
    .values({
      id: personId,
      sex: 'U',
      isLiving: false,
      privacyLevel: 'public',
      createdBy: userId,
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

  return personId;
}

/**
 * Phase 2: write evidence for a (factsheet -> person) pair:
 *   - events (one per fact-type group, stamped with sourceFactsheetId)
 *   - sources (one per distinct research_item_id)
 *   - source_citations (one per source, attached to person)
 *   - research_facts.source_citation_id (back-link each fact to its citation)
 *
 * Caller must be inside an open transaction.
 *
 * Returns counts of events + sources created.
 */
export async function _writeFactsheetEvidence(
  db: Database,
  factsheetId: string,
  personId: string,
  userId: string,
  now: string,
): Promise<{ eventsCreated: number; sourcesCreated: number }> {
  const facts = await selectAcceptedFacts(db, factsheetId);

  let eventsCreated = 0;
  let sourcesCreated = 0;

  // Create events from date/place facts. Group by event type so a birth_date
  // + birth_place collapse into one event row (verbatim from previous inline
  // implementation).
  const eventGroups = new Map<string, { date?: string; place?: string; dateFact?: AcceptedFact; placeFact?: AcceptedFact }>();

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
        sourceFactsheetId: factsheetId,
        dateOriginal: group.date ?? null,
        dateSort: group.dateFact?.factDateSort ?? null,
        placeText: group.place ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    eventsCreated++;
  }

  // Create source + citations from linked research items.
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
        createdBy: userId,
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
      WHERE factsheet_id = ${factsheetId}
        AND research_item_id = ${riId}
    `);

    sourcesCreated++;
  }

  return { eventsCreated, sourcesCreated };
}
