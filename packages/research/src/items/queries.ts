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

export function createResearchItem(db: Database, input: CreateResearchItemInput) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  db.insert(researchItems)
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

  const [item] = db
    .select()
    .from(researchItems)
    .where(eq(researchItems.id, id))
    .all();

  return { id: item.id, title: item.title, status: item.status, createdAt: item.createdAt };
}

export function getResearchItem(db: Database, id: string) {
  const [item] = db
    .select()
    .from(researchItems)
    .where(eq(researchItems.id, id))
    .all();

  if (!item) return null;

  const personRows = db
    .select({ personId: researchItemPersons.personId })
    .from(researchItemPersons)
    .where(eq(researchItemPersons.researchItemId, id))
    .all();

  return {
    ...item,
    personIds: personRows.map((r) => r.personId),
  };
}

export function listResearchItems(db: Database, filters?: ResearchItemFilters) {
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

  const items = db
    .select()
    .from(researchItems)
    .where(whereClause)
    .orderBy(desc(researchItems.createdAt))
    .all();

  // Batch-fetch personIds for all items
  const itemIds = items.map((i) => i.id);
  const allPersonTags =
    itemIds.length > 0
      ? db
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

export function updateResearchItemStatus(
  db: Database,
  id: string,
  status: 'draft' | 'promoted' | 'dismissed'
) {
  db.update(researchItems)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(researchItems.id, id))
    .run();
}

export function updateResearchItemNotes(db: Database, id: string, notes: string) {
  db.update(researchItems)
    .set({ notes, updatedAt: new Date().toISOString() })
    .where(eq(researchItems.id, id))
    .run();
}

export function tagPersonToItem(db: Database, itemId: string, personId: string) {
  db.insert(researchItemPersons)
    .values({ researchItemId: itemId, personId })
    .run();
}

export function untagPersonFromItem(db: Database, itemId: string, personId: string) {
  db.delete(researchItemPersons)
    .where(
      and(
        eq(researchItemPersons.researchItemId, itemId),
        eq(researchItemPersons.personId, personId)
      )
    )
    .run();
}

export function deleteResearchItem(db: Database, id: string) {
  db.delete(researchItems)
    .where(eq(researchItems.id, id))
    .run();
}
