'use server';

import { createDb, persons, personNames, families, children, events } from '@ancstra/db';
import { isNull, sql } from 'drizzle-orm';
import { auth } from '@/auth';
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
  const [{ count }] = db
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

  db.transaction((tx) => {
    // 1. Insert persons
    for (const p of data.persons) {
      tx.insert(persons)
        .values({
          id: p.id,
          sex: p.sex,
          isLiving: p.isLiving,
          notes: p.notes,
          createdBy: session.user?.id ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    // 2. Insert person names
    for (const n of data.names) {
      tx.insert(personNames)
        .values({
          id: n.id,
          personId: n.personId,
          givenName: n.givenName,
          surname: n.surname,
          suffix: n.suffix,
          prefix: n.prefix,
          nameType: n.nameType as 'birth',
          isPrimary: n.isPrimary,
          createdAt: now,
        })
        .run();
    }

    // 3. Insert families
    for (const f of data.families) {
      tx.insert(families)
        .values({
          id: f.id,
          partner1Id: f.partner1Id,
          partner2Id: f.partner2Id,
          validationStatus: 'confirmed',
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    // 4. Insert children (child links)
    for (const cl of data.childLinks) {
      tx.insert(children)
        .values({
          id: crypto.randomUUID(),
          familyId: cl.familyId,
          personId: cl.personId,
          validationStatus: 'confirmed',
          createdAt: now,
        })
        .run();
    }

    // 5. Insert events
    for (const e of data.events) {
      tx.insert(events)
        .values({
          id: e.id,
          eventType: e.eventType,
          dateOriginal: e.dateOriginal,
          dateSort: e.dateSort,
          dateModifier: e.dateModifier as any,
          dateEndSort: e.dateEndSort,
          placeText: e.placeText,
          personId: e.personId,
          familyId: e.familyId,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });

  return {
    imported: {
      persons: data.persons.length,
      families: data.families.length,
      events: data.events.length,
    },
  };
}
