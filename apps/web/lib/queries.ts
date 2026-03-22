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
import type BetterSqlite3 from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Exported: FTS5 full-text search for persons
// ---------------------------------------------------------------------------
export function searchPersonsFts(
  db: Database,
  query: string,
  limit: number = 10,
): PersonListItem[] {
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

  // Access the raw better-sqlite3 instance from Drizzle
  const rawDb = (db as any).$client as BetterSqlite3.Database;

  const rows = rawDb
    .prepare(
      `SELECT p.id, p.sex, p.is_living as isLiving, pn.given_name as givenName, pn.surname
       FROM persons_fts
       JOIN person_names pn ON pn.rowid = persons_fts.rowid
       JOIN persons p ON p.id = pn.person_id
       WHERE persons_fts MATCH ?
         AND p.deleted_at IS NULL
         AND pn.is_primary = 1
       ORDER BY bm25(persons_fts)
       LIMIT ?`,
    )
    .all(matchExpr, limit) as Array<{
    id: string;
    sex: string;
    isLiving: number;
    givenName: string;
    surname: string;
  }>;

  // Fetch birth/death dates for each matched person
  return rows.map((row) => {
    const birthEvent = rawDb
      .prepare(
        `SELECT date_original FROM events WHERE person_id = ? AND event_type = 'birth' LIMIT 1`,
      )
      .get(row.id) as { date_original: string | null } | undefined;

    const deathEvent = rawDb
      .prepare(
        `SELECT date_original FROM events WHERE person_id = ? AND event_type = 'death' LIMIT 1`,
      )
      .get(row.id) as { date_original: string | null } | undefined;

    return {
      id: row.id,
      givenName: row.givenName,
      surname: row.surname,
      sex: row.sex,
      isLiving: Boolean(row.isLiving),
      birthDate: birthEvent?.date_original ?? null,
      deathDate: deathEvent?.date_original ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Private helper: build a PersonListItem from a personId
// ---------------------------------------------------------------------------
function getPersonListItem(
  db: Database,
  personId: string,
): PersonListItem | null {
  const row = db
    .select({
      id: persons.id,
      sex: persons.sex,
      isLiving: persons.isLiving,
    })
    .from(persons)
    .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
    .get();

  if (!row) return null;

  const name = db
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

  const birthEvent = db
    .select({ dateOriginal: events.dateOriginal })
    .from(events)
    .where(and(eq(events.personId, personId), eq(events.eventType, 'birth')))
    .get();

  const deathEvent = db
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
export function findFamiliesAsChild(
  db: Database,
  personId: string,
): string[] {
  const rows = db
    .select({ familyId: children.familyId })
    .from(children)
    .where(eq(children.personId, personId))
    .all();

  return rows.map((r) => r.familyId);
}

// ---------------------------------------------------------------------------
// Exported: find family IDs where person appears as partner1 or partner2
// ---------------------------------------------------------------------------
export function findFamiliesAsPartner(
  db: Database,
  personId: string,
): string[] {
  const rows = db
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
export function findOrCreateFamilyForChild(
  db: Database,
  childId: string,
  parentId: string,
  parentRole: 'partner1' | 'partner2',
): string {
  const existingFamilyIds = findFamiliesAsChild(db, childId);

  if (existingFamilyIds.length > 0) {
    // Update the first existing family to set the parent in the given role
    const familyId = existingFamilyIds[0];
    const col =
      parentRole === 'partner1' ? families.partner1Id : families.partner2Id;
    db.update(families).set({ [col.name]: parentId }).where(eq(families.id, familyId)).run();
    return familyId;
  }

  // No existing family — create one
  const familyId = crypto.randomUUID();
  db.insert(families)
    .values({
      id: familyId,
      ...(parentRole === 'partner1'
        ? { partner1Id: parentId }
        : { partner2Id: parentId }),
    })
    .run();

  db.insert(children)
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
export function assemblePersonDetail(
  db: Database,
  personId: string,
): PersonDetail | null {
  // 1. Person + primary name
  const person = db
    .select()
    .from(persons)
    .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
    .get();

  if (!person) return null;

  const primaryName = db
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
  const partnerFamilyIds = findFamiliesAsPartner(db, personId);
  const spouseMap = new Map<string, PersonListItem>();

  for (const fId of partnerFamilyIds) {
    const fam = db
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
      const item = getPersonListItem(db, oid);
      if (item) spouseMap.set(oid, item);
    }
  }

  // 3. Parents: children table where person is child → family → non-null, non-deleted partners
  const childFamilyIds = findFamiliesAsChild(db, personId);
  const parentMap = new Map<string, PersonListItem>();

  for (const fId of childFamilyIds) {
    const fam = db
      .select({ partner1Id: families.partner1Id, partner2Id: families.partner2Id })
      .from(families)
      .where(eq(families.id, fId))
      .get();

    if (!fam) continue;

    for (const pid of [fam.partner1Id, fam.partner2Id]) {
      if (!pid || parentMap.has(pid)) continue;
      const item = getPersonListItem(db, pid);
      if (item) parentMap.set(pid, item);
    }
  }

  // 4. Children: families where person is partner → children records → getPersonListItem each
  const childMap = new Map<string, PersonListItem>();

  for (const fId of partnerFamilyIds) {
    const childRows = db
      .select({ personId: children.personId })
      .from(children)
      .where(eq(children.familyId, fId))
      .all();

    for (const cr of childRows) {
      if (childMap.has(cr.personId)) continue;
      const item = getPersonListItem(db, cr.personId);
      if (item) childMap.set(cr.personId, item);
    }
  }

  // 5. All events for person, ordered by dateSort ASC NULLS LAST
  const personEvents = db
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
export function getTreeData(db: Database): TreeData {
  const personRows = db
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
    ? db
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

  const familyRows: FamilyRecord[] = db
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

  const childRows: ChildLink[] = db
    .select({
      familyId: children.familyId,
      personId: children.personId,
      validationStatus: children.validationStatus,
    })
    .from(children)
    .all();

  return { persons: personsWithDates, families: familyRows, childLinks: childRows };
}
