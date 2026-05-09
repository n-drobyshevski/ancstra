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
// Exported: find or create a family record where `parentId` is a partner.
// Returns the existing family if one already lists `parentId` as partner1 or
// partner2 (regardless of the other slot). Otherwise creates a new
// single-parent family with `parentId` in partner1.
//
// Used by parent-child write paths to prevent each "add child" call from
// minting a new families row for the same parent.
// ---------------------------------------------------------------------------
export async function findOrCreateFamilyForParent(
  db: Database,
  parentId: string,
): Promise<string> {
  const existing = await findFamiliesAsPartner(db, parentId);
  if (existing.length > 0) return existing[0];

  const familyId = crypto.randomUUID();
  await db.insert(families)
    .values({ id: familyId, partner1Id: parentId })
    .run();
  return familyId;
}

// ---------------------------------------------------------------------------
// Exported: find or create a family from a partner specification, with full
// dedup. Both-partner inserts dedup on the unordered pair (either direction).
// Single-partner inserts dedup on any active family where the named partner
// already appears as partner1 or partner2 — this is what prevents a "create
// single-parent family" UI flow from minting a fresh row each time the user
// re-opens the dialog.
// ---------------------------------------------------------------------------
export interface FamilyPartnerSpec {
  partner1Id?: string | null;
  partner2Id?: string | null;
  relationshipType?: 'married' | 'civil_union' | 'domestic_partner' | 'unmarried' | 'unknown';
}

export async function findOrCreateFamilyByPartners(
  db: Database,
  spec: FamilyPartnerSpec,
): Promise<{ familyId: string; created: boolean }> {
  const p1 = spec.partner1Id ?? null;
  const p2 = spec.partner2Id ?? null;

  if (p1 && p2) {
    const [existing] = await db
      .select({ id: families.id })
      .from(families)
      .where(
        and(
          isNull(families.deletedAt),
          or(
            and(eq(families.partner1Id, p1), eq(families.partner2Id, p2)),
            and(eq(families.partner1Id, p2), eq(families.partner2Id, p1)),
          ),
        ),
      )
      .all();
    if (existing) return { familyId: existing.id, created: false };
  } else {
    const onePartner = p1 ?? p2;
    if (onePartner) {
      const partnerFams = await findFamiliesAsPartner(db, onePartner);
      if (partnerFams.length > 0) {
        return { familyId: partnerFams[0], created: false };
      }
    }
  }

  const familyId = crypto.randomUUID();
  await db.insert(families)
    .values({
      id: familyId,
      partner1Id: p1,
      partner2Id: p2,
      relationshipType: spec.relationshipType ?? 'unknown',
      validationStatus: 'confirmed',
    })
    .run();
  return { familyId, created: true };
}

// ---------------------------------------------------------------------------
// Exported: soft-delete a family record if it is now an empty container
// (zero or one partners AND no remaining children). Two-partner families
// without children are kept — they may legitimately represent a marriage
// record where no children have been entered yet.
//
// Returns true when a soft-delete actually happened, false otherwise.
// Use after removing a child link or soft-deleting a partner person to keep
// the families table from accumulating dangling stubs.
// ---------------------------------------------------------------------------
export async function softDeleteFamilyIfEmpty(
  db: Database,
  familyId: string,
): Promise<boolean> {
  const [fam] = await db
    .select({
      id: families.id,
      partner1Id: families.partner1Id,
      partner2Id: families.partner2Id,
      deletedAt: families.deletedAt,
    })
    .from(families)
    .where(eq(families.id, familyId))
    .all();

  if (!fam || fam.deletedAt) return false;

  // Both partners present → keep, even childless (marriage-only record).
  if (fam.partner1Id && fam.partner2Id) return false;

  const [{ kids }] = await db
    .select({ kids: sql<number>`count(*)` })
    .from(children)
    .where(eq(children.familyId, familyId))
    .all();

  if (kids > 0) return false;

  const now = new Date().toISOString();
  await db.update(families)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(families.id, familyId))
    .run();
  return true;
}

// ---------------------------------------------------------------------------
// Exported: link a child to a parent's family, reusing an existing one if the
// parent already has a family record. Idempotent: calling twice with the same
// (parent, child) is a no-op for the second call.
//
// Returns `childLinked: true` only when the children row was actually
// inserted, so the caller can run closure-table updates conditionally.
// ---------------------------------------------------------------------------
export async function linkChildToParent(
  db: Database,
  parentId: string,
  childId: string,
): Promise<{ familyId: string; childLinked: boolean }> {
  const familyId = await findOrCreateFamilyForParent(db, parentId);

  const [existing] = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.familyId, familyId), eq(children.personId, childId)))
    .all();

  if (existing) return { familyId, childLinked: false };

  await db.insert(children)
    .values({ familyId, personId: childId })
    .run();

  return { familyId, childLinked: true };
}

// ---------------------------------------------------------------------------
// Exported: link two persons as siblings via a shared parent family
//
// If `personId` already has a parent family, `siblingId` is added as a child
// to the first such family. Otherwise an "unknown-parents" family (both
// partners null) is created and both persons are linked as children. Idempotent
// on the (familyId, siblingId) child link.
// ---------------------------------------------------------------------------
export async function addSibling(
  db: Database,
  personId: string,
  siblingId: string,
): Promise<{ familyId: string; alreadyLinked: boolean }> {
  const existingFamilyIds = await findFamiliesAsChild(db, personId);

  let familyId: string;

  if (existingFamilyIds.length > 0) {
    familyId = existingFamilyIds[0];
  } else {
    familyId = crypto.randomUUID();
    await db.insert(families)
      .values({ id: familyId })
      .run();
    await db.insert(children)
      .values({ familyId, personId })
      .run();
  }

  const [existing] = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.familyId, familyId), eq(children.personId, siblingId)))
    .all();

  if (existing) {
    return { familyId, alreadyLinked: true };
  }

  await db.insert(children)
    .values({ familyId, personId: siblingId })
    .run();

  return { familyId, alreadyLinked: false };
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

  // 4b. Siblings: other children of any of person's parent families
  const siblingIds: string[] = [];

  if (childFamilyIds.length > 0) {
    const siblingChildRows = await db
      .select({ personId: children.personId })
      .from(children)
      .where(inArray(children.familyId, childFamilyIds))
      .all();

    for (const cr of siblingChildRows) {
      if (cr.personId === personId) continue;
      if (!siblingIds.includes(cr.personId)) siblingIds.push(cr.personId);
    }
  }

  // 5. ONE batch query to person_summary for all related persons
  const allRelatedIds = [...new Set([...spouseIds, ...parentIds, ...childPersonIds, ...siblingIds])];
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

  const siblingMap = new Map<string, PersonListItem>();
  for (const sid of siblingIds) {
    const item = batchMap.get(sid);
    if (item) siblingMap.set(sid, item);
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
    siblings: Array.from(siblingMap.values()),
    events: personEvents,
  };
}

// ---------------------------------------------------------------------------
// Exported: fetch all tree data (persons + families + child links)
//
// Reads denormalized facets from person_summary in a single scan (vs the prior
// CTE+facets pattern that re-derived completeness/validation per row). All
// three sub-queries fire in parallel — wall time = max(slowest), not sum.
// ---------------------------------------------------------------------------
export async function getTreeData(db: Database): Promise<TreeData> {
  const [personRows, familyRows, childRows] = await Promise.all([
    db.all<{
      person_id: string;
      given_name: string;
      surname: string;
      sex: string;
      is_living: number;
      birth_date: string | null;
      birth_place: string | null;
      death_date: string | null;
      completeness: number;
      has_name: number;
      has_birth_event: number;
      has_birth_place: number;
      has_death_event: number;
      has_source: number;
      validation: 'confirmed' | 'proposed';
      sources_count: number;
    }>(sql`
      SELECT
        ps.person_id, ps.given_name, ps.surname, ps.sex, ps.is_living,
        ps.birth_date, ps.death_date, ps.birth_place,
        ps.completeness, ps.validation, ps.sources_count,
        ps.has_name, ps.has_birth_event, ps.has_birth_place,
        ps.has_death_event, ps.has_source
      FROM person_summary ps
      WHERE NOT EXISTS (
        SELECT 1 FROM persons p
        WHERE p.id = ps.person_id AND p.deleted_at IS NOT NULL
      )
    `),
    db
      .select({
        id: families.id,
        partner1Id: families.partner1Id,
        partner2Id: families.partner2Id,
        relationshipType: families.relationshipType,
        validationStatus: families.validationStatus,
      })
      .from(families)
      .where(isNull(families.deletedAt))
      .all(),
    db
      .select({
        familyId: children.familyId,
        personId: children.personId,
        validationStatus: children.validationStatus,
        childOrder: children.childOrder,
      })
      .from(children)
      .all(),
  ]);

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

  return {
    persons: personsWithDates,
    families: familyRows as FamilyRecord[],
    childLinks: childRows as ChildLink[],
  };
}

// ---------------------------------------------------------------------------
// Exported: pending proposed relationships (canvas overlay)
//
// Per CLAUDE.md, AI/API discoveries land in `proposed_relationships` and are
// kept off the canonical tree until validated. The web app stores each user's
// tree in its own SQLite DB (see authContext.dbFilename), so there is no
// treeId scoping — every row belongs to this user's tree. The JOIN against
// `persons` skips proposals whose endpoints have been soft-deleted.
// ---------------------------------------------------------------------------
export interface ProposedRelationshipForCanvas {
  id: string;
  person1Id: string;
  person2Id: string;
  relationshipType: 'parent_child' | 'partner' | 'sibling';
  sourceType:
    | 'familysearch'
    | 'nara'
    | 'ai_suggestion'
    | 'record_match'
    | 'ocr_extraction'
    | 'user_proposal';
  confidence: number | null;
}

export async function getProposedRelationshipsForTree(
  db: Database,
): Promise<ProposedRelationshipForCanvas[]> {
  const rows = await db.all<{
    id: string;
    person1_id: string;
    person2_id: string;
    relationship_type: ProposedRelationshipForCanvas['relationshipType'];
    source_type: ProposedRelationshipForCanvas['sourceType'];
    confidence: number | null;
  }>(sql`
    SELECT pr.id, pr.person1_id, pr.person2_id, pr.relationship_type,
           pr.source_type, pr.confidence
    FROM proposed_relationships pr
    JOIN persons p1 ON p1.id = pr.person1_id
    JOIN persons p2 ON p2.id = pr.person2_id
    WHERE pr.status = 'pending'
      AND p1.deleted_at IS NULL
      AND p2.deleted_at IS NULL
  `);
  return rows.map((r) => ({
    id: r.id,
    person1Id: r.person1_id,
    person2Id: r.person2_id,
    relationshipType: r.relationship_type,
    sourceType: r.source_type,
    confidence: r.confidence,
  }));
}
