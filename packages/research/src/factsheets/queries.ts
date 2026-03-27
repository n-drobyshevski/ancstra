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
