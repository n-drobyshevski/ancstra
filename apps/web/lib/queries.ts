import { eq, and, or, isNull, inArray, sql } from 'drizzle-orm';
import {
  type Database,
  persons,
  personNames,
  events,
  families,
  children,
} from '@ancstra/db';
import type {
  PersonDetail,
  PersonListItem,
  Event as EventType,
  TreeData,
  FamilyRecord,
  ChildLink,
} from '@ancstra/shared';
// ---------------------------------------------------------------------------
// Exported: Full-text search for persons (FTS5 with LIKE fallback)
// ---------------------------------------------------------------------------
export async function searchPersonsFts(
  db: Database,
  query: string,
  limit: number = 10,
): Promise<PersonListItem[]> {
  const sanitized = query.replace(/['"*()]/g, '').trim();
  if (!sanitized) return [];

  // Try FTS5 first, fall back to LIKE if the virtual table doesn't exist
  try {
    const matchExpr = sanitized
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `${w}*`)
      .join(' ');

    if (!matchExpr) return [];

    const rows = await db.all<{
      id: string;
      sex: string;
      isLiving: number;
      givenName: string;
      surname: string;
      birthDate: string | null;
      deathDate: string | null;
    }>(sql`
      SELECT p.id, p.sex, p.is_living as isLiving,
             pn.given_name as givenName, pn.surname,
             ps.birth_date as birthDate, ps.death_date as deathDate
      FROM persons_fts
      JOIN person_names pn ON pn.rowid = persons_fts.rowid
      JOIN persons p ON p.id = pn.person_id
      LEFT JOIN person_summary ps ON ps.person_id = p.id
      WHERE persons_fts MATCH ${matchExpr}
        AND p.deleted_at IS NULL
        AND pn.is_primary = 1
      ORDER BY bm25(persons_fts)
      LIMIT ${limit}
    `);

    return rows.map((row): PersonListItem => ({
      id: row.id,
      givenName: row.givenName,
      surname: row.surname,
      sex: row.sex as 'M' | 'F' | 'U',
      isLiving: Boolean(row.isLiving),
      birthDate: row.birthDate ?? null,
      deathDate: row.deathDate ?? null,
    }));
  } catch (err) {
    // FTS5 not available — fall back to LIKE search
    console.warn(
      '[search] FTS5 query failed, falling back to LIKE search.',
      err instanceof Error ? err.message : err,
    );
  }

  return searchPersonsLike(db, sanitized, limit);
}

// ---------------------------------------------------------------------------
// Private: LIKE-based fallback search (works on all SQLite backends)
// ---------------------------------------------------------------------------
async function searchPersonsLike(
  db: Database,
  query: string,
  limit: number,
): Promise<PersonListItem[]> {
  const pattern = `%${query}%`;

  const rows = await db.all<{
    id: string;
    sex: string;
    isLiving: number;
    givenName: string;
    surname: string;
    birthDate: string | null;
    deathDate: string | null;
  }>(sql`
    SELECT p.id, p.sex, p.is_living as isLiving,
           pn.given_name as givenName, pn.surname,
           ps.birth_date as birthDate, ps.death_date as deathDate
    FROM person_names pn
    JOIN persons p ON p.id = pn.person_id
    LEFT JOIN person_summary ps ON ps.person_id = p.id
    WHERE (pn.given_name LIKE ${pattern} OR pn.surname LIKE ${pattern})
      AND p.deleted_at IS NULL
      AND pn.is_primary = 1
    ORDER BY pn.surname, pn.given_name
    LIMIT ${limit}
  `);

  return rows.map((row): PersonListItem => ({
    id: row.id,
    givenName: row.givenName,
    surname: row.surname,
    sex: row.sex as 'M' | 'F' | 'U',
    isLiving: Boolean(row.isLiving),
    birthDate: row.birthDate ?? null,
    deathDate: row.deathDate ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Private helper: build a PersonListItem from a personId
// ---------------------------------------------------------------------------
async function getPersonListItem(
  db: Database,
  personId: string,
): Promise<PersonListItem | null> {
  const row = await db
    .select({
      id: persons.id,
      sex: persons.sex,
      isLiving: persons.isLiving,
    })
    .from(persons)
    .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
    .get();

  if (!row) return null;

  const name = await db
    .select({
      givenName: personNames.givenName,
      surname: personNames.surname,
    })
    .from(personNames)
    .where(
      and(
        eq(personNames.personId, personId),
        eq(personNames.isPrimary, true),
      ),
    )
    .get();

  const birthEvent = await db
    .select({ dateOriginal: events.dateOriginal })
    .from(events)
    .where(and(eq(events.personId, personId), eq(events.eventType, 'birth')))
    .get();

  const deathEvent = await db
    .select({ dateOriginal: events.dateOriginal })
    .from(events)
    .where(and(eq(events.personId, personId), eq(events.eventType, 'death')))
    .get();

  return {
    id: row.id,
    givenName: name?.givenName ?? '',
    surname: name?.surname ?? '',
    sex: row.sex,
    isLiving: row.isLiving,
    birthDate: birthEvent?.dateOriginal ?? null,
    deathDate: deathEvent?.dateOriginal ?? null,
  };
}

// ---------------------------------------------------------------------------
// Private helper: batch-fetch PersonListItems from person_summary
// ---------------------------------------------------------------------------
async function getPersonListItemsBatch(
  db: Database,
  personIds: string[],
): Promise<Map<string, PersonListItem>> {
  if (personIds.length === 0) return new Map();

  const rows = await db.all<{
    person_id: string;
    given_name: string;
    surname: string;
    sex: string;
    is_living: number;
    birth_date: string | null;
    death_date: string | null;
  }>(sql`
    SELECT person_id, given_name, surname, sex, is_living, birth_date, death_date
    FROM person_summary
    WHERE person_id IN (${sql.join(personIds.map((id) => sql`${id}`), sql`, `)})
  `);

  const map = new Map<string, PersonListItem>();
  for (const r of rows) {
    map.set(r.person_id, {
      id: r.person_id,
      givenName: r.given_name,
      surname: r.surname,
      sex: r.sex as 'M' | 'F' | 'U',
      isLiving: Boolean(r.is_living),
      birthDate: r.birth_date,
      deathDate: r.death_date,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Exported: find family IDs where person appears as a child
// ---------------------------------------------------------------------------
export async function findFamiliesAsChild(
  db: Database,
  personId: string,
): Promise<string[]> {
  const rows = await db
    .select({ familyId: children.familyId })
    .from(children)
    .where(eq(children.personId, personId))
    .all();

  return rows.map((r) => r.familyId);
}

// ---------------------------------------------------------------------------
// Exported: find family IDs where person appears as partner1 or partner2
// ---------------------------------------------------------------------------
export async function findFamiliesAsPartner(
  db: Database,
  personId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: families.id })
    .from(families)
    .where(
      and(
        or(
          eq(families.partner1Id, personId),
          eq(families.partner2Id, personId),
        ),
        isNull(families.deletedAt),
      ),
    )
    .all();

  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Exported: find or create a family record linking a child to a parent
// ---------------------------------------------------------------------------
export async function findOrCreateFamilyForChild(
  db: Database,
  childId: string,
  parentId: string,
  parentRole: 'partner1' | 'partner2',
): Promise<string> {
  const existingFamilyIds = await findFamiliesAsChild(db, childId);

  if (existingFamilyIds.length > 0) {
    // Update the first existing family to set the parent in the given role
    const familyId = existingFamilyIds[0];
    const col =
      parentRole === 'partner1' ? families.partner1Id : families.partner2Id;
    await db.update(families).set({ [col.name]: parentId }).where(eq(families.id, familyId)).run();
    return familyId;
  }

  // No existing family — create one
  const familyId = crypto.randomUUID();
  await db.insert(families)
    .values({
      id: familyId,
      ...(parentRole === 'partner1'
        ? { partner1Id: parentId }
        : { partner2Id: parentId }),
    })
    .run();

  await db.insert(children)
    .values({
      familyId,
      personId: childId,
    })
    .run();

  return familyId;
}

// ---------------------------------------------------------------------------
// Exported: assemble a full PersonDetail — the single source of truth
// ---------------------------------------------------------------------------
export async function assemblePersonDetail(
  db: Database,
  personId: string,
): Promise<PersonDetail | null> {
  // 1. Person + primary name
  const person = await db
    .select()
    .from(persons)
    .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
    .get();

  if (!person) return null;

  const primaryName = await db
    .select()
    .from(personNames)
    .where(
      and(
        eq(personNames.personId, personId),
        eq(personNames.isPrimary, true),
      ),
    )
    .get();

  // 2. Spouses: batch-fetch all families where person is a partner
  const partnerFamilyIds = await findFamiliesAsPartner(db, personId);

  const partnerFamilyRecords = new Map<
    string,
    { partner1Id: string | null; partner2Id: string | null }
  >();
  const spouseIds: string[] = [];

  if (partnerFamilyIds.length > 0) {
    const famRows = await db
      .select({ id: families.id, partner1Id: families.partner1Id, partner2Id: families.partner2Id })
      .from(families)
      .where(and(inArray(families.id, partnerFamilyIds), isNull(families.deletedAt)))
      .all();

    for (const fam of famRows) {
      partnerFamilyRecords.set(fam.id, fam);
      if (fam.partner1Id && fam.partner1Id !== personId && !spouseIds.includes(fam.partner1Id)) {
        spouseIds.push(fam.partner1Id);
      }
      if (fam.partner2Id && fam.partner2Id !== personId && !spouseIds.includes(fam.partner2Id)) {
        spouseIds.push(fam.partner2Id);
      }
    }
  }

  // 3. Parents: batch-fetch families where person is a child
  const childFamilyIds = await findFamiliesAsChild(db, personId);
  const parentIds: string[] = [];

  if (childFamilyIds.length > 0) {
    const parentFamRows = await db
      .select({ partner1Id: families.partner1Id, partner2Id: families.partner2Id })
      .from(families)
      .where(inArray(families.id, childFamilyIds))
      .all();

    for (const fam of parentFamRows) {
      for (const pid of [fam.partner1Id, fam.partner2Id]) {
        if (pid && !parentIds.includes(pid)) parentIds.push(pid);
      }
    }
  }

  // 4. Children: batch-fetch all child links for partner families
  const childPersonIds: string[] = [];
  const childFamilyChildRows = new Map<string, string[]>();

  if (partnerFamilyIds.length > 0) {
    const allChildRows = await db
      .select({ familyId: children.familyId, personId: children.personId })
      .from(children)
      .where(inArray(children.familyId, partnerFamilyIds))
      .all();

    for (const cr of allChildRows) {
      if (!partnerFamilyRecords.has(cr.familyId)) continue;
      const existing = childFamilyChildRows.get(cr.familyId) ?? [];
      existing.push(cr.personId);
      childFamilyChildRows.set(cr.familyId, existing);
      if (!childPersonIds.includes(cr.personId)) childPersonIds.push(cr.personId);
    }
  }

  // 5. ONE batch query to person_summary for all related persons
  const allRelatedIds = [...new Set([...spouseIds, ...parentIds, ...childPersonIds])];
  const batchMap = await getPersonListItemsBatch(db, allRelatedIds);

  // 6. Distribute batch results into typed maps
  const spouseMap = new Map<string, PersonListItem>();
  for (const sid of spouseIds) {
    const item = batchMap.get(sid);
    if (item) spouseMap.set(sid, item);
  }

  const parentMap = new Map<string, PersonListItem>();
  for (const pid of parentIds) {
    const item = batchMap.get(pid);
    if (item) parentMap.set(pid, item);
  }

  const childMap = new Map<string, PersonListItem>();
  for (const cid of childPersonIds) {
    const item = batchMap.get(cid);
    if (item) childMap.set(cid, item);
  }

  // 7. All events for person, ordered by dateSort ASC NULLS LAST
  const personEvents = await db
    .select()
    .from(events)
    .where(eq(events.personId, personId))
    .orderBy(sql`${events.dateSort} ASC NULLS LAST`)
    .all() as EventType[];

  // Extract birth/death info from events
  const birthEvent = personEvents.find((e) => e.eventType === 'birth');
  const deathEvent = personEvents.find((e) => e.eventType === 'death');

  return {
    id: person.id,
    sex: person.sex,
    isLiving: person.isLiving,
    privacyLevel: person.privacyLevel,
    notes: person.notes,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
    givenName: primaryName?.givenName ?? '',
    surname: primaryName?.surname ?? '',
    prefix: primaryName?.prefix ?? null,
    suffix: primaryName?.suffix ?? null,
    birthDate: birthEvent?.dateOriginal ?? null,
    birthPlace: birthEvent?.placeText ?? null,
    deathDate: deathEvent?.dateOriginal ?? null,
    deathPlace: deathEvent?.placeText ?? null,
    spouses: Array.from(spouseMap.values()),
    parents: Array.from(parentMap.values()),
    children: Array.from(childMap.values()),
    events: personEvents,
  };
}

// ---------------------------------------------------------------------------
// Exported: fetch all tree data (persons + families + child links)
// ---------------------------------------------------------------------------
export async function getTreeData(db: Database): Promise<TreeData> {
  // Read from denormalized person_summary table joined with on-the-fly
  // completeness/validation/sources facets (mirrors query-persons-list.ts).
  const personRows = await db.all<{
    person_id: string;
    given_name: string;
    surname: string;
    sex: string;
    is_living: number;
    birth_date: string | null;
    birth_place: string | null;
    death_date: string | null;
    completeness: number | null;
    has_name: number | null;
    has_birth_event: number | null;
    has_birth_place: number | null;
    has_death_event: number | null;
    has_source: number | null;
    validation: 'confirmed' | 'proposed' | null;
    sources_count: number | null;
  }>(sql`
    WITH person_flags AS (
      SELECT
        p.id,
        CASE WHEN pn.given_name IS NOT NULL AND pn.given_name <> '' AND pn.surname IS NOT NULL AND pn.surname <> '' THEN 1 ELSE 0 END AS has_name,
        CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth') THEN 1 ELSE 0 END AS has_birth_event,
        CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth' AND e.place_text IS NOT NULL AND e.place_text <> '') THEN 1 ELSE 0 END AS has_birth_place,
        CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'death') THEN 1 ELSE 0 END AS has_death_event,
        CASE WHEN EXISTS (SELECT 1 FROM source_citations sc WHERE sc.person_id = p.id) THEN 1 ELSE 0 END AS has_source
      FROM persons p
      LEFT JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
      WHERE p.deleted_at IS NULL
    ),
    person_facets AS (
      SELECT
        p.id,
        pf.has_name, pf.has_birth_event, pf.has_birth_place,
        pf.has_death_event, pf.has_source,
        (
          pf.has_name * 20 + pf.has_birth_event * 25
          + pf.has_birth_place * 20 + pf.has_death_event * 15
          + pf.has_source * 20
        ) AS completeness,
        CASE WHEN EXISTS (
          SELECT 1 FROM families f
          WHERE f.deleted_at IS NULL
            AND (f.partner1_id = p.id OR f.partner2_id = p.id)
            AND f.validation_status IN ('proposed', 'disputed')
        ) OR EXISTS (
          SELECT 1 FROM children c
          WHERE c.person_id = p.id
            AND c.validation_status IN ('proposed', 'disputed')
        ) THEN 'proposed' ELSE 'confirmed' END AS validation,
        (SELECT COUNT(*) FROM source_citations sc WHERE sc.person_id = p.id) AS sources_count,
        (SELECT place_text FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth' ORDER BY e.date_sort NULLS LAST LIMIT 1) AS birth_place
      FROM persons p
      INNER JOIN person_flags pf ON pf.id = p.id
      WHERE p.deleted_at IS NULL
    )
    SELECT
      ps.person_id, ps.given_name, ps.surname, ps.sex, ps.is_living,
      ps.birth_date, ps.death_date,
      pf.birth_place,
      pf.completeness, pf.validation, pf.sources_count,
      pf.has_name, pf.has_birth_event, pf.has_birth_place,
      pf.has_death_event, pf.has_source
    FROM person_summary ps
    LEFT JOIN person_facets pf ON pf.id = ps.person_id
    WHERE ps.person_id NOT IN (SELECT id FROM persons WHERE deleted_at IS NOT NULL)
  `);

  const personsWithDates: PersonListItem[] = personRows.map((r) => ({
    id: r.person_id,
    givenName: r.given_name,
    surname: r.surname,
    sex: r.sex as 'M' | 'F' | 'U',
    isLiving: Boolean(r.is_living),
    birthDate: r.birth_date,
    birthPlace: r.birth_place,
    deathDate: r.death_date,
    completeness: r.completeness ?? 0,
    validation: r.validation ?? 'confirmed',
    sourcesCount: r.sources_count ?? 0,
    hasName: Boolean(r.has_name),
    hasBirthEvent: Boolean(r.has_birth_event),
    hasBirthPlace: Boolean(r.has_birth_place),
    hasDeathEvent: Boolean(r.has_death_event),
    hasSource: Boolean(r.has_source),
  }));

  const familyRows: FamilyRecord[] = await db
    .select({
      id: families.id,
      partner1Id: families.partner1Id,
      partner2Id: families.partner2Id,
      relationshipType: families.relationshipType,
      validationStatus: families.validationStatus,
    })
    .from(families)
    .where(isNull(families.deletedAt))
    .all();

  const childRows: ChildLink[] = await db
    .select({
      familyId: children.familyId,
      personId: children.personId,
      validationStatus: children.validationStatus,
    })
    .from(children)
    .all();

  return { persons: personsWithDates, families: familyRows, childLinks: childRows };
}
