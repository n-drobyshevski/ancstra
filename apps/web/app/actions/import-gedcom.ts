'use server';

import { createDb, persons, personNames, families, children, events, createCentralDb } from '@ancstra/db';
import { isNull, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { updateTag, revalidateTag } from 'next/cache';
import { logActivity, type ActivityAction } from '@ancstra/auth';
import { getAuthContext } from '@/lib/auth/context';
import { parseGedcomFile } from '@/lib/gedcom/parse';
import { mapGedcomToImport } from '@/lib/gedcom/mapper';
import type { GedcomPreview } from '@/lib/gedcom/types';

// ---------------------------------------------------------------------------
// previewGedcom — parse file and return stats without touching the DB
// ---------------------------------------------------------------------------
export async function previewGedcom(formData: FormData): Promise<GedcomPreview> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided');

  const buffer = await file.arrayBuffer();
  const ast = parseGedcomFile(buffer);
  const data = mapGedcomToImport(ast);

  const db = createDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(isNull(persons.deletedAt))
    .all();

  return {
    stats: data.stats,
    warnings: data.warnings,
    existingPersonCount: count,
  };
}

// ---------------------------------------------------------------------------
// commitGedcomImport — re-parse file and insert all records in a transaction
// ---------------------------------------------------------------------------
export async function commitGedcomImport(
  formData: FormData,
): Promise<{ imported: { persons: number; families: number; events: number } }> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided');

  const buffer = await file.arrayBuffer();
  const ast = parseGedcomFile(buffer);
  const data = mapGedcomToImport(ast);

  const db = createDb();
  const now = new Date().toISOString();

  const CHUNK = 500;

  await db.transaction(async (tx) => {
    // 1. Insert persons (chunked batch)
    const personRows = data.persons.map((p) => ({
      id: p.id,
      sex: p.sex,
      isLiving: p.isLiving,
      notes: p.notes,
      createdBy: session.user?.id ?? null,
      createdAt: now,
      updatedAt: now,
    }));
    for (let i = 0; i < personRows.length; i += CHUNK) {
      await tx.insert(persons).values(personRows.slice(i, i + CHUNK)).run();
    }

    // 2. Insert person names (chunked batch)
    const nameRows = data.names.map((n) => ({
      id: n.id,
      personId: n.personId,
      givenName: n.givenName,
      surname: n.surname,
      suffix: n.suffix,
      prefix: n.prefix,
      nameType: n.nameType as 'birth',
      isPrimary: n.isPrimary,
      createdAt: now,
    }));
    for (let i = 0; i < nameRows.length; i += CHUNK) {
      await tx.insert(personNames).values(nameRows.slice(i, i + CHUNK)).run();
    }

    // 3. Insert families (chunked batch)
    const familyRows = data.families.map((f) => ({
      id: f.id,
      partner1Id: f.partner1Id,
      partner2Id: f.partner2Id,
      validationStatus: 'confirmed' as const,
      createdAt: now,
      updatedAt: now,
    }));
    for (let i = 0; i < familyRows.length; i += CHUNK) {
      await tx.insert(families).values(familyRows.slice(i, i + CHUNK)).run();
    }

    // 4. Insert children (chunked batch)
    const childRows = data.childLinks.map((cl) => ({
      id: crypto.randomUUID(),
      familyId: cl.familyId,
      personId: cl.personId,
      validationStatus: 'confirmed' as const,
      createdAt: now,
    }));
    for (let i = 0; i < childRows.length; i += CHUNK) {
      await tx.insert(children).values(childRows.slice(i, i + CHUNK)).run();
    }

    // 5. Insert events (chunked batch)
    const eventRows = data.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      dateOriginal: e.dateOriginal,
      dateSort: e.dateSort,
      dateModifier: e.dateModifier as 'exact' | 'about' | 'estimated' | 'before' | 'after' | 'between' | 'calculated' | 'interpreted' | null,
      dateEndSort: e.dateEndSort,
      placeText: e.placeText,
      personId: e.personId,
      familyId: e.familyId,
      createdAt: now,
      updatedAt: now,
    }));
    for (let i = 0; i < eventRows.length; i += CHUNK) {
      await tx.insert(events).values(eventRows.slice(i, i + CHUNK)).run();
    }
  });

  updateTag('persons');
  updateTag('tree-data');
  updateTag('dashboard');

  // Log activity if auth context is available
  const authCtx = await getAuthContext();
  if (authCtx) {
    const centralDb = createCentralDb();
    await logActivity(centralDb, {
      familyId: authCtx.familyId,
      userId: authCtx.userId,
      action: 'gedcom_imported' as ActivityAction,
      entityType: 'import',
      summary: `Imported GEDCOM file (${data.persons.length} people, ${data.families.length} families)`,
      metadata: { persons: data.persons.length, families: data.families.length, events: data.events.length },
    });
    revalidateTag('activity');
  }

  return {
    imported: {
      persons: data.persons.length,
      families: data.families.length,
      events: data.events.length,
    },
  };
}
