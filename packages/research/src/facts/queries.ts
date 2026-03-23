import { eq, asc } from 'drizzle-orm';
import { researchFacts } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export interface CreateFactInput {
  personId: string;
  factType: 'name' | 'birth_date' | 'birth_place' | 'death_date' | 'death_place'
    | 'marriage_date' | 'marriage_place' | 'residence' | 'occupation'
    | 'immigration' | 'military_service' | 'religion' | 'ethnicity'
    | 'parent_name' | 'spouse_name' | 'child_name' | 'other';
  factValue: string;
  factDateSort?: number;
  researchItemId?: string;
  sourceCitationId?: string;
  confidence?: 'high' | 'medium' | 'low' | 'disputed';
  extractionMethod?: 'manual' | 'ai_extracted' | 'ocr_extracted';
}

export interface UpdateFactInput {
  factValue?: string;
  confidence?: 'high' | 'medium' | 'low' | 'disputed';
}

export async function createFact(db: Database, input: CreateFactInput) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.insert(researchFacts)
    .values({
      id,
      personId: input.personId,
      factType: input.factType,
      factValue: input.factValue,
      factDateSort: input.factDateSort ?? null,
      researchItemId: input.researchItemId ?? null,
      sourceCitationId: input.sourceCitationId ?? null,
      confidence: input.confidence ?? 'medium',
      extractionMethod: input.extractionMethod ?? 'manual',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const facts = await db
    .select()
    .from(researchFacts)
    .where(eq(researchFacts.id, id))
    .all();

  return facts[0];
}

export async function getFactsByPerson(db: Database, personId: string) {
  return await db
    .select()
    .from(researchFacts)
    .where(eq(researchFacts.personId, personId))
    .orderBy(asc(researchFacts.factDateSort))
    .all();
}

export async function getFactsByResearchItem(db: Database, researchItemId: string) {
  return await db
    .select()
    .from(researchFacts)
    .where(eq(researchFacts.researchItemId, researchItemId))
    .orderBy(asc(researchFacts.factDateSort))
    .all();
}

export async function updateFact(db: Database, factId: string, data: UpdateFactInput) {
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (data.factValue !== undefined) updates.factValue = data.factValue;
  if (data.confidence !== undefined) updates.confidence = data.confidence;

  await db.update(researchFacts)
    .set(updates)
    .where(eq(researchFacts.id, factId))
    .run();

  const facts = await db
    .select()
    .from(researchFacts)
    .where(eq(researchFacts.id, factId))
    .all();

  return facts[0] ?? null;
}

export async function deleteFact(db: Database, factId: string) {
  await db.delete(researchFacts)
    .where(eq(researchFacts.id, factId))
    .run();
}
