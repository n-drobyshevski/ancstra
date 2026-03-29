import { eq, asc, sql } from 'drizzle-orm';
import { researchFacts } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export interface CreateFactInput {
  personId?: string | null;
  factType: 'name' | 'birth_date' | 'birth_place' | 'death_date' | 'death_place'
    | 'marriage_date' | 'marriage_place' | 'residence' | 'occupation'
    | 'immigration' | 'military_service' | 'religion' | 'ethnicity'
    | 'parent_name' | 'spouse_name' | 'child_name' | 'other';
  factValue: string;
  factDateSort?: number;
  researchItemId?: string;
  factsheetId?: string;
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
      personId: input.personId ?? null,
      factType: input.factType,
      factValue: input.factValue,
      factDateSort: input.factDateSort ?? null,
      researchItemId: input.researchItemId ?? null,
      factsheetId: input.factsheetId ?? null,
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

export async function getFactsByFactsheet(db: Database, factsheetId: string) {
  return await db
    .select()
    .from(researchFacts)
    .where(eq(researchFacts.factsheetId, factsheetId))
    .orderBy(asc(researchFacts.factDateSort))
    .all();
}

export async function batchCreateFacts(db: Database, inputs: CreateFactInput[]) {
  if (inputs.length === 0) return [];

  const now = new Date().toISOString();
  const ids: string[] = [];

  for (const input of inputs) {
    const id = crypto.randomUUID();
    ids.push(id);

    await db.insert(researchFacts)
      .values({
        id,
        personId: input.personId ?? null,
        factType: input.factType,
        factValue: input.factValue,
        factDateSort: input.factDateSort ?? null,
        researchItemId: input.researchItemId ?? null,
        factsheetId: input.factsheetId ?? null,
        sourceCitationId: input.sourceCitationId ?? null,
        confidence: input.confidence ?? 'medium',
        extractionMethod: input.extractionMethod ?? 'manual',
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  return await db
    .select()
    .from(researchFacts)
    .where(sql`${researchFacts.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`)
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
