import { sql } from 'drizzle-orm';
import type { FamilyDatabase } from './index';

/**
 * Refresh the person_summary row for a single person.
 * DELETE + re-INSERT using simple individual queries.
 * If the person doesn't exist or is deleted, the row is removed (no-op insert).
 */
export async function refreshSummary(db: FamilyDatabase, personId: string): Promise<void> {
  // Always delete existing summary row first
  db.run(sql`DELETE FROM person_summary WHERE person_id = ${personId}`);

  // 1. Check person exists and is not deleted
  const personRows = db.all<{ id: string; sex: string; is_living: number }>(
    sql`SELECT id, sex, is_living FROM persons WHERE id = ${personId} AND deleted_at IS NULL`
  );
  if (personRows.length === 0) return;
  const person = personRows[0];

  // 2. Query primary name
  const nameRows = db.all<{ given_name: string; surname: string }>(
    sql`SELECT given_name, surname FROM person_names WHERE person_id = ${personId} AND is_primary = 1 LIMIT 1`
  );
  const givenName = nameRows.length > 0 ? nameRows[0].given_name : '';
  const surname = nameRows.length > 0 ? nameRows[0].surname : '';

  // 3. Query birth event
  const birthRows = db.all<{ date_original: string | null; date_sort: number | null; place_text: string | null }>(
    sql`SELECT date_original, date_sort, place_text FROM events WHERE person_id = ${personId} AND event_type = 'birth' LIMIT 1`
  );
  const birth = birthRows.length > 0 ? birthRows[0] : null;

  // 4. Query death event
  const deathRows = db.all<{ date_original: string | null; date_sort: number | null; place_text: string | null }>(
    sql`SELECT date_original, date_sort, place_text FROM events WHERE person_id = ${personId} AND event_type = 'death' LIMIT 1`
  );
  const death = deathRows.length > 0 ? deathRows[0] : null;

  // 5. Count spouses
  const spouseRows = db.all<{ cnt: number }>(
    sql`SELECT COUNT(*) as cnt FROM families WHERE deleted_at IS NULL AND partner1_id IS NOT NULL AND partner2_id IS NOT NULL AND (partner1_id = ${personId} OR partner2_id = ${personId})`
  );
  const spouseCount = spouseRows[0]?.cnt ?? 0;

  // 6. Count children
  const childRows = db.all<{ cnt: number }>(
    sql`SELECT COUNT(DISTINCT c.person_id) as cnt FROM children c JOIN families f ON f.id = c.family_id AND f.deleted_at IS NULL WHERE f.partner1_id = ${personId} OR f.partner2_id = ${personId}`
  );
  const childCount = childRows[0]?.cnt ?? 0;

  // 7. Count parents: count non-null partners in families where this person is a child
  const parentRows = db.all<{ partner1_id: string | null; partner2_id: string | null }>(
    sql`SELECT f.partner1_id, f.partner2_id FROM children c JOIN families f ON f.id = c.family_id AND f.deleted_at IS NULL WHERE c.person_id = ${personId}`
  );
  const parentIds = new Set<string>();
  for (const row of parentRows) {
    if (row.partner1_id) parentIds.add(row.partner1_id);
    if (row.partner2_id) parentIds.add(row.partner2_id);
  }
  const parentCount = parentIds.size;

  // 8. INSERT into person_summary
  const now = new Date().toISOString();
  const birthDate = birth?.date_original ?? null;
  const birthDateSort = birth?.date_sort ?? null;
  const birthPlace = birth?.place_text ?? null;
  const deathDate = death?.date_original ?? null;
  const deathDateSort = death?.date_sort ?? null;
  const deathPlace = death?.place_text ?? null;

  db.run(sql`
    INSERT INTO person_summary (person_id, given_name, surname, sex, is_living, birth_date, death_date, birth_date_sort, death_date_sort, birth_place, death_place, spouse_count, child_count, parent_count, updated_at)
    VALUES (${personId}, ${givenName}, ${surname}, ${person.sex}, ${person.is_living}, ${birthDate}, ${deathDate}, ${birthDateSort}, ${deathDateSort}, ${birthPlace}, ${deathPlace}, ${spouseCount}, ${childCount}, ${parentCount}, ${now})
  `);
}

/**
 * Full rebuild: delete all person_summary rows, then iterate all non-deleted
 * person IDs and call refreshSummary for each.
 */
export async function rebuildAllSummaries(db: FamilyDatabase): Promise<void> {
  db.run(sql`DELETE FROM person_summary`);

  const allPersons = db.all<{ id: string }>(
    sql`SELECT id FROM persons WHERE deleted_at IS NULL`
  );

  for (const person of allPersons) {
    await refreshSummary(db, person.id);
  }
}

/**
 * Refresh summaries for a person and all their immediate family members
 * (spouses, parents, children).
 */
export async function refreshRelatedSummaries(db: FamilyDatabase, personId: string): Promise<void> {
  const relatedIds = new Set<string>();
  relatedIds.add(personId);

  // Spouses: query families where this person is partner1 or partner2, add the other partner
  const spouseFamilies = db.all<{ partner1_id: string | null; partner2_id: string | null }>(
    sql`SELECT partner1_id, partner2_id FROM families WHERE deleted_at IS NULL AND (partner1_id = ${personId} OR partner2_id = ${personId})`
  );
  for (const fam of spouseFamilies) {
    if (fam.partner1_id && fam.partner1_id !== personId) relatedIds.add(fam.partner1_id);
    if (fam.partner2_id && fam.partner2_id !== personId) relatedIds.add(fam.partner2_id);
  }

  // Parents: query children table for this personId, then get family's partners
  const parentFamilies = db.all<{ family_id: string }>(
    sql`SELECT family_id FROM children WHERE person_id = ${personId}`
  );
  for (const link of parentFamilies) {
    const famRows = db.all<{ partner1_id: string | null; partner2_id: string | null }>(
      sql`SELECT partner1_id, partner2_id FROM families WHERE id = ${link.family_id} AND deleted_at IS NULL`
    );
    for (const fam of famRows) {
      if (fam.partner1_id) relatedIds.add(fam.partner1_id);
      if (fam.partner2_id) relatedIds.add(fam.partner2_id);
    }
  }

  // Children: query families where this person is a partner, then get children of those families
  const myFamilies = db.all<{ id: string }>(
    sql`SELECT id FROM families WHERE deleted_at IS NULL AND (partner1_id = ${personId} OR partner2_id = ${personId})`
  );
  for (const fam of myFamilies) {
    const kidRows = db.all<{ person_id: string }>(
      sql`SELECT person_id FROM children WHERE family_id = ${fam.id}`
    );
    for (const kid of kidRows) {
      relatedIds.add(kid.person_id);
    }
  }

  // Refresh all collected IDs
  for (const id of relatedIds) {
    await refreshSummary(db, id);
  }
}
