import { eq, and, sql, asc, desc, isNull } from 'drizzle-orm';
import { factsheets, researchFacts, factsheetLinks } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export interface CreateFactsheetInput {
  title: string;
  entityType?: 'person' | 'couple' | 'family_unit';
  notes?: string;
  createdBy: string;
}

export interface UpdateFactsheetInput {
  title?: string;
  notes?: string;
  status?: 'draft' | 'ready' | 'promoted' | 'merged' | 'dismissed';
}

export interface FactsheetFilters {
  status?: string;
  createdBy?: string;
  personId?: string;
}

export async function createFactsheet(db: Database, input: CreateFactsheetInput) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(factsheets)
    .values({
      id,
      title: input.title,
      entityType: input.entityType ?? 'person',
      notes: input.notes ?? null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return (await db.select().from(factsheets).where(eq(factsheets.id, id)).all())[0];
}

export async function getFactsheet(db: Database, id: string) {
  const rows = await db.select().from(factsheets).where(eq(factsheets.id, id)).all();
  if (!rows[0]) return null;

  const facts = await db.select()
    .from(researchFacts)
    .where(eq(researchFacts.factsheetId, id))
    .orderBy(asc(researchFacts.factType))
    .all();

  const links = await db.select()
    .from(factsheetLinks)
    .where(
      sql`${factsheetLinks.fromFactsheetId} = ${id} OR ${factsheetLinks.toFactsheetId} = ${id}`
    )
    .all();

  return { ...rows[0], facts, links };
}

export async function listFactsheets(db: Database, filters: FactsheetFilters = {}) {
  let query = db.select().from(factsheets);

  if (filters.status) {
    query = query.where(eq(factsheets.status, filters.status as any)) as any;
  }
  if (filters.createdBy) {
    query = query.where(eq(factsheets.createdBy, filters.createdBy)) as any;
  }

  const rows = await (query as any).orderBy(desc(factsheets.updatedAt)).all();

  // If filtering by personId, find factsheets that have facts for that person
  if (filters.personId) {
    const factsheetIds = await db.all<{ factsheetId: string }>(sql`
      SELECT DISTINCT factsheet_id as factsheetId
      FROM research_facts
      WHERE person_id = ${filters.personId}
        AND factsheet_id IS NOT NULL
    `);
    const idSet = new Set(factsheetIds.map(r => r.factsheetId));
    return rows.filter((r: any) => idSet.has(r.id));
  }

  return rows;
}

export interface FactsheetWithCounts {
  id: string;
  title: string;
  entityType: 'person' | 'couple' | 'family_unit';
  status: 'draft' | 'ready' | 'promoted' | 'merged' | 'dismissed';
  notes: string | null;
  promotedPersonId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  factCount: number;
  linkCount: number;
  conflictCount: number;
  isUnanchored: boolean;
}

export async function listFactsheetsWithCounts(
  db: Database,
  filters: FactsheetFilters = {}
): Promise<FactsheetWithCounts[]> {
  const rows = await listFactsheets(db, filters);
  if (rows.length === 0) return [];

  const ids = rows.map((r: any) => r.id as string);
  const idList = ids.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(',');

  // Batch-fetch fact counts per factsheet
  const factCountRows = await db.all<{ factsheetId: string; cnt: number }>(sql`
    SELECT factsheet_id AS factsheetId, COUNT(*) AS cnt
    FROM research_facts
    WHERE factsheet_id IN (${sql.raw(idList)})
    GROUP BY factsheet_id
  `);
  const factCountMap = new Map<string, number>(
    factCountRows.map((r) => [r.factsheetId, r.cnt])
  );

  // Batch-fetch link counts per factsheet (from + to directions)
  const linkCountRows = await db.all<{ factsheetId: string; cnt: number }>(sql`
    SELECT factsheet_id AS factsheetId, COUNT(*) AS cnt FROM (
      SELECT from_factsheet_id AS factsheet_id FROM factsheet_links
        WHERE from_factsheet_id IN (${sql.raw(idList)})
      UNION ALL
      SELECT to_factsheet_id AS factsheet_id FROM factsheet_links
        WHERE to_factsheet_id IN (${sql.raw(idList)})
    ) GROUP BY factsheet_id
  `);
  const linkCountMap = new Map<string, number>(
    linkCountRows.map((r) => [r.factsheetId, r.cnt])
  );

  // Batch-fetch anchored factsheet IDs (have at least one fact with non-null person_id)
  const anchoredRows = await db.all<{ factsheetId: string }>(sql`
    SELECT DISTINCT factsheet_id AS factsheetId
    FROM research_facts
    WHERE factsheet_id IN (${sql.raw(idList)})
      AND person_id IS NOT NULL
  `);
  const anchoredSet = new Set<string>(anchoredRows.map((r) => r.factsheetId));

  // Batch-fetch conflict counts — facts with accepted = null grouped by factsheet
  const conflictRows = await db.all<{ factsheetId: string; cnt: number }>(sql`
    SELECT factsheet_id AS factsheetId, COUNT(*) AS cnt
    FROM research_facts
    WHERE factsheet_id IN (${sql.raw(idList)})
      AND accepted IS NULL
    GROUP BY factsheet_id
  `);
  const conflictMap = new Map<string, number>(
    conflictRows.map((r) => [r.factsheetId, r.cnt])
  );

  return rows.map((r: any) => ({
    ...r,
    factCount: factCountMap.get(r.id) ?? 0,
    linkCount: linkCountMap.get(r.id) ?? 0,
    conflictCount: conflictMap.get(r.id) ?? 0,
    isUnanchored: !anchoredSet.has(r.id),
  }));
}

export async function updateFactsheet(db: Database, id: string, data: UpdateFactsheetInput) {
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (data.title !== undefined) updates.title = data.title;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.status !== undefined) updates.status = data.status;

  await db.update(factsheets)
    .set(updates)
    .where(eq(factsheets.id, id))
    .run();

  return (await db.select().from(factsheets).where(eq(factsheets.id, id)).all())[0] ?? null;
}

export async function deleteFactsheet(db: Database, id: string) {
  // Unlink facts (don't delete them)
  await db.update(researchFacts)
    .set({ factsheetId: null, updatedAt: new Date().toISOString() })
    .where(eq(researchFacts.factsheetId, id))
    .run();

  // Links cascade-delete via FK
  await db.delete(factsheets)
    .where(eq(factsheets.id, id))
    .run();
}

export async function assignFactToFactsheet(db: Database, factId: string, factsheetId: string) {
  await db.update(researchFacts)
    .set({ factsheetId, updatedAt: new Date().toISOString() })
    .where(eq(researchFacts.id, factId))
    .run();
}

export async function removeFactFromFactsheet(db: Database, factId: string) {
  await db.update(researchFacts)
    .set({ factsheetId: null, updatedAt: new Date().toISOString() })
    .where(eq(researchFacts.id, factId))
    .run();
}
