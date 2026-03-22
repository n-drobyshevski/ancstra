import { eq, and, or, isNull, sql } from 'drizzle-orm';
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
// Exported: FTS5 full-text search for persons
// ---------------------------------------------------------------------------
export async function searchPersonsFts(
  db: Database,
  query: string,
  limit: number = 10,
): Promise<PersonListItem[]> {
  // Sanitize: strip FTS5 special characters
  const sanitized = query.replace(/['"*()]/g, '').trim();
  if (!sanitized) return [];

  // Build FTS5 match expression: prefix each word with *
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
  }>(sql`
    SELECT p.id, p.sex, p.is_living as isLiving, pn.given_name as givenName, pn.surname
    FROM persons_fts
    JOIN person_names pn ON pn.rowid = persons_fts.rowid
    JOIN persons p ON p.id = pn.person_id
    WHERE persons_fts MATCH ${matchExpr}
      AND p.deleted_at IS NULL
      AND pn.is_primary = 1
    ORDER BY bm25(persons_fts)
    LIMIT ${limit}
  `);

  // Fetch birth/death dates for each matched person
  return Promise.all(rows.map(async (row): Promise<PersonListItem> => {
    const [birthEvent] = await db.all<{ date_original: string | null }>(sql`
      SELECT date_original FROM events WHERE person_id = ${row.id} AND event_type = 'birth' LIMIT 1
    `);

    const [deathEvent] = await db.all<{ date_original: string | null }>(sql`
      SELECT date_original FROM events WHERE person_id = ${row.id} AND event_type = 'death' LIMIT 1
    `);

    return {
      id: row.id,
      givenName: row.givenName,
      surname: row.surname,
      sex: row.sex as 'M' | 'F' | 'U',
      isLiving: Boolean(row.isLiving),
      birthDate: birthEvent?.date_original ?? null,
      deathDate: deathEvent?.date_original ?? null,
    };
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

  // 2. Spouses: families where person is a partner → extract OTHER partner
  const partnerFamilyIds = await findFamiliesAsPartner(db, personId);
  const spouseMap = new Map<string, PersonListItem>();

  for (const fId of partnerFamilyIds) {
    const fam = await db
      .select({ partner1Id: families.partner1Id, partner2Id: families.partner2Id })
      .from(families)
      .where(and(eq(families.id, fId), isNull(families.deletedAt)))
      .get();

    if (!fam) continue;

    // The "other" partner is the one that is not personId
    const otherIds: (string | null)[] = [];
    if (fam.partner1Id && fam.partner1Id !== personId) otherIds.push(fam.partner1Id);
    if (fam.partner2Id && fam.partner2Id !== personId) otherIds.push(fam.partner2Id);

    for (const oid of otherIds) {
      if (!oid || spouseMap.has(oid)) continue;
      const item = await getPersonListItem(db, oid);
      if (item) spouseMap.set(oid, item);
    }
  }

  // 3. Parents: children table where person is child → family → non-null, non-deleted partners
  const childFamilyIds = await findFamiliesAsChild(db, personId);
  const parentMap = new Map<string, PersonListItem>();

  for (const fId of childFamilyIds) {
    const fam = await db
      .select({ partner1Id: families.partner1Id, partner2Id: families.partner2Id })
      .from(families)
      .where(eq(families.id, fId))
      .get();

    if (!fam) continue;

    for (const pid of [fam.partner1Id, fam.partner2Id]) {
      if (!pid || parentMap.has(pid)) continue;
      const item = await getPersonListItem(db, pid);
      if (item) parentMap.set(pid, item);
    }
  }

  // 4. Children: families where person is partner → children records → getPersonListItem each
  const childMap = new Map<string, PersonListItem>();

  for (const fId of partnerFamilyIds) {
    const childRows = await db
      .select({ personId: children.personId })
      .from(children)
      .where(eq(children.familyId, fId))
      .all();

    for (const cr of childRows) {
      if (childMap.has(cr.personId)) continue;
      const item = await getPersonListItem(db, cr.personId);
      if (item) childMap.set(cr.personId, item);
    }
  }

  // 5. All events for person, ordered by dateSort ASC NULLS LAST
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
  const personRows = await db
    .select({
      id: persons.id,
      sex: persons.sex,
      isLiving: persons.isLiving,
      givenName: personNames.givenName,
      surname: personNames.surname,
    })
    .from(persons)
    .innerJoin(
      personNames,
      and(eq(personNames.personId, persons.id), eq(personNames.isPrimary, true))
    )
    .where(isNull(persons.deletedAt))
    .all();

  const personIds = personRows.map((r) => r.id);
  const birthDeathEvents = personIds.length > 0
    ? await db
        .select({
          personId: events.personId,
          eventType: events.eventType,
          dateOriginal: events.dateOriginal,
        })
        .from(events)
        .where(
          sql`${events.personId} IN (${sql.join(
            personIds.map((id) => sql`${id}`),
            sql`, `
          )}) AND ${events.eventType} IN ('birth', 'death')`
        )
        .all()
    : [];

  const eventsByPerson = new Map<string, { birthDate?: string | null; deathDate?: string | null }>();
  for (const ev of birthDeathEvents) {
    if (!ev.personId) continue;
    const entry = eventsByPerson.get(ev.personId) ?? {};
    if (ev.eventType === 'birth') entry.birthDate = ev.dateOriginal;
    if (ev.eventType === 'death') entry.deathDate = ev.dateOriginal;
    eventsByPerson.set(ev.personId, entry);
  }

  const personsWithDates = personRows.map((r) => ({
    ...r,
    birthDate: eventsByPerson.get(r.id)?.birthDate ?? null,
    deathDate: eventsByPerson.get(r.id)?.deathDate ?? null,
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
