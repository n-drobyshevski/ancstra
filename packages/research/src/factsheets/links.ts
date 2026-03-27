import { eq, sql } from 'drizzle-orm';
import { factsheetLinks, factsheets, researchFacts } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export interface CreateFactsheetLinkInput {
  fromFactsheetId: string;
  toFactsheetId: string;
  relationshipType: 'parent_child' | 'spouse' | 'sibling';
  sourceFactId?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export async function createFactsheetLink(db: Database, input: CreateFactsheetLinkInput) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(factsheetLinks)
    .values({
      id,
      fromFactsheetId: input.fromFactsheetId,
      toFactsheetId: input.toFactsheetId,
      relationshipType: input.relationshipType,
      sourceFactId: input.sourceFactId ?? null,
      confidence: input.confidence ?? 'medium',
      createdAt: now,
    })
    .run();

  return (await db.select().from(factsheetLinks).where(eq(factsheetLinks.id, id)).all())[0];
}

export async function getFactsheetLinks(db: Database, factsheetId: string) {
  return await db.select()
    .from(factsheetLinks)
    .where(
      sql`${factsheetLinks.fromFactsheetId} = ${factsheetId} OR ${factsheetLinks.toFactsheetId} = ${factsheetId}`
    )
    .all();
}

export async function deleteFactsheetLink(db: Database, linkId: string) {
  await db.delete(factsheetLinks)
    .where(eq(factsheetLinks.id, linkId))
    .run();
}

/**
 * BFS traversal to find all connected factsheets in a cluster.
 * Used for family unit promotion.
 */
export async function getFactsheetCluster(db: Database, startId: string): Promise<string[]> {
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const links = await db.select()
      .from(factsheetLinks)
      .where(
        sql`${factsheetLinks.fromFactsheetId} = ${current} OR ${factsheetLinks.toFactsheetId} = ${current}`
      )
      .all();

    for (const link of links) {
      const neighbor = link.fromFactsheetId === current ? link.toFactsheetId : link.fromFactsheetId;
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return Array.from(visited);
}

/**
 * Suggest factsheet links based on relationship facts.
 * Looks for parent_name, spouse_name, child_name facts and tries
 * to match them against other factsheets by title.
 */
export async function suggestFactsheetLinks(db: Database, factsheetId: string) {
  const RELATIONSHIP_FACT_TYPES = ['parent_name', 'spouse_name', 'child_name'] as const;

  // Get relationship facts on this factsheet
  const relationFacts = await db.all<{
    id: string;
    factType: string;
    factValue: string;
  }>(sql`
    SELECT id, fact_type as factType, fact_value as factValue
    FROM research_facts
    WHERE factsheet_id = ${factsheetId}
      AND fact_type IN ('parent_name', 'spouse_name', 'child_name')
  `);

  if (relationFacts.length === 0) return [];

  // Get all non-dismissed factsheets (excluding self)
  const allSheets = await db.select()
    .from(factsheets)
    .where(sql`${factsheets.id} != ${factsheetId} AND ${factsheets.status} != 'dismissed'`)
    .all();

  // Get existing links
  const existingLinks = await getFactsheetLinks(db, factsheetId);
  const linkedIds = new Set(
    existingLinks.flatMap(l => [l.fromFactsheetId, l.toFactsheetId])
  );

  const suggestions: Array<{
    factId: string;
    factType: string;
    factValue: string;
    suggestedFactsheetId: string;
    suggestedFactsheetTitle: string;
    relationshipType: 'parent_child' | 'spouse' | 'sibling';
  }> = [];

  for (const fact of relationFacts) {
    const normalizedValue = fact.factValue.toLowerCase().trim();

    for (const sheet of allSheets) {
      if (linkedIds.has(sheet.id)) continue;

      const normalizedTitle = sheet.title.toLowerCase().trim();
      if (normalizedTitle.includes(normalizedValue) || normalizedValue.includes(normalizedTitle)) {
        const relType = fact.factType === 'spouse_name' ? 'spouse'
          : fact.factType === 'parent_name' ? 'parent_child'
          : 'parent_child'; // child_name: this factsheet is parent

        suggestions.push({
          factId: fact.id,
          factType: fact.factType,
          factValue: fact.factValue,
          suggestedFactsheetId: sheet.id,
          suggestedFactsheetTitle: sheet.title,
          relationshipType: relType,
        });
      }
    }
  }

  return suggestions;
}
