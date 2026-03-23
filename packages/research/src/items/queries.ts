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
  status?: 'draft' | 'promoted' | 'dismissed';
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

  if (filters?.status) {
    conditions.push(eq(researchItems.status, filters.status));
  }
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

export async function updateResearchItemStatus(
  db: Database,
  id: string,
  status: 'draft' | 'promoted' | 'dismissed'
) {
  await db.update(researchItems)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(researchItems.id, id))
    .run();
}

export async function updateResearchItemNotes(db: Database, id: string, notes: string) {
  await db.update(researchItems)
    .set({ notes, updatedAt: new Date().toISOString() })
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
