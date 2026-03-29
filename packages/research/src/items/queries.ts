import { eq, desc, and, sql } from 'drizzle-orm';
import { researchItems, researchItemPersons } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export interface CreateResearchItemInput {
  title: string;
  url?: string;
  snippet?: string;
  fullText?: string;
  notes?: string;
  providerId?: string;
  providerRecordId?: string;
  discoveryMethod: 'search' | 'scrape' | 'paste_url' | 'paste_text' | 'ai_suggestion';
  searchQuery?: string;
  createdBy: string;
}

export interface ResearchItemFilters {
  personId?: string;
  createdBy?: string;
}

export async function createResearchItem(db: Database, input: CreateResearchItemInput) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(researchItems)
    .values({
      id,
      title: input.title,
      url: input.url ?? null,
      snippet: input.snippet ?? null,
      fullText: input.fullText ?? null,
      notes: input.notes ?? null,
      providerId: input.providerId ?? null,
      providerRecordId: input.providerRecordId ?? null,
      discoveryMethod: input.discoveryMethod,
      searchQuery: input.searchQuery ?? null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const items = await db
    .select()
    .from(researchItems)
    .where(eq(researchItems.id, id))
    .all();

  const item = items[0];
  return { id: item.id, title: item.title, status: item.status, createdAt: item.createdAt };
}

export async function getResearchItem(db: Database, id: string) {
  const items = await db
    .select()
    .from(researchItems)
    .where(eq(researchItems.id, id))
    .all();

  const item = items[0];
  if (!item) return null;

  const personRows = await db
    .select({ personId: researchItemPersons.personId })
    .from(researchItemPersons)
    .where(eq(researchItemPersons.researchItemId, id))
    .all();

  return {
    ...item,
    personIds: personRows.map((r) => r.personId),
  };
}

export async function listResearchItems(db: Database, filters?: ResearchItemFilters) {
  const conditions = [];

  if (filters?.createdBy) {
    conditions.push(eq(researchItems.createdBy, filters.createdBy));
  }

  // If filtering by personId, we need a subquery
  if (filters?.personId) {
    conditions.push(
      sql`${researchItems.id} IN (
        SELECT ${researchItemPersons.researchItemId}
        FROM ${researchItemPersons}
        WHERE ${researchItemPersons.personId} = ${filters.personId}
      )`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(researchItems)
    .where(whereClause)
    .orderBy(desc(researchItems.createdAt))
    .all();

  // Batch-fetch personIds for all items
  const itemIds = items.map((i) => i.id);
  const allPersonTags =
    itemIds.length > 0
      ? await db
          .select()
          .from(researchItemPersons)
          .where(
            sql`${researchItemPersons.researchItemId} IN (${sql.join(
              itemIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
          .all()
      : [];

  const personMap = new Map<string, string[]>();
  for (const tag of allPersonTags) {
    const existing = personMap.get(tag.researchItemId) ?? [];
    existing.push(tag.personId);
    personMap.set(tag.researchItemId, existing);
  }

  return items.map((item) => ({
    ...item,
    personIds: personMap.get(item.id) ?? [],
  }));
}

export async function updateResearchItemNotes(db: Database, id: string, notes: string) {
  await db.update(researchItems)
    .set({ notes, updatedAt: new Date().toISOString() })
    .where(eq(researchItems.id, id))
    .run();
}

export interface UpdateResearchItemContentInput {
  title?: string;
  snippet?: string | null;
  fullText?: string | null;
}

export async function updateResearchItemContent(
  db: Database,
  id: string,
  input: UpdateResearchItemContentInput
) {
  const fields: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.title !== undefined) fields.title = input.title;
  if (input.snippet !== undefined) fields.snippet = input.snippet;
  if (input.fullText !== undefined) fields.fullText = input.fullText;

  await db.update(researchItems)
    .set(fields as any)
    .where(eq(researchItems.id, id))
    .run();
}

export async function tagPersonToItem(db: Database, itemId: string, personId: string) {
  await db.insert(researchItemPersons)
    .values({ researchItemId: itemId, personId })
    .run();
}

export async function untagPersonFromItem(db: Database, itemId: string, personId: string) {
  await db.delete(researchItemPersons)
    .where(
      and(
        eq(researchItemPersons.researchItemId, itemId),
        eq(researchItemPersons.personId, personId)
      )
    )
    .run();
}

export async function deleteResearchItem(db: Database, id: string) {
  await db.delete(researchItems)
    .where(eq(researchItems.id, id))
    .run();
}

/**
 * List research items not linked to any person (unanchored inbox).
 */
export async function listUnanchoredItems(db: Database, opts?: { limit?: number; offset?: number }) {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  return await db.all<{
    id: string;
    title: string;
    url: string | null;
    snippet: string | null;
    status: string;
    discoveryMethod: string;
    createdAt: string;
  }>(sql`
    SELECT ri.id, ri.title, ri.url, ri.snippet, ri.status,
           ri.discovery_method as discoveryMethod, ri.created_at as createdAt
    FROM research_items ri
    WHERE NOT EXISTS (
        SELECT 1 FROM research_item_persons rip
        WHERE rip.research_item_id = ri.id
      )
    ORDER BY ri.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
}

/**
 * Count unanchored research items (for inbox badge).
 */
export async function getUnanchoredCount(db: Database): Promise<number> {
  const rows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM research_items ri
    WHERE NOT EXISTS (
        SELECT 1 FROM research_item_persons rip
        WHERE rip.research_item_id = ri.id
      )
  `);
  return rows[0]?.count ?? 0;
}
