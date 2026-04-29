import type { z } from 'zod/v3';
import type { FamilyDatabase } from '@ancstra/db';
import { persons, personNames, events, families, children } from '@ancstra/db';
import type { createPersonSchema } from '@/lib/validation';
import { parseDateToSort } from '@ancstra/shared';
import { findOrCreateFamilyForChild, findFamiliesAsPartner, addSibling } from '@/lib/queries';

export interface RelationContext {
  relation: string | null;
  ofPersonId: string | null;
}

// The 6-insert sequence has strict ordering requirements: persons must exist before
// personNames/events reference it, and families must exist before children link to them.
export async function insertRelatedPerson(
  db: FamilyDatabase,
  input: z.infer<typeof createPersonSchema>,
  ctx: RelationContext,
  createdBy: string | null,
): Promise<string> {
  const personId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    // Insert 1: person record
    await tx.insert(persons)
      .values({
        id: personId,
        sex: input.sex,
        isLiving: input.isLiving,
        notes: input.notes ?? null,
        createdBy,
      })
      .run();

    // Insert 2: primary name
    await tx.insert(personNames)
      .values({
        personId,
        givenName: input.givenName,
        surname: input.surname,
        nameType: 'birth',
        isPrimary: true,
      })
      .run();

    // Insert 3: birth event (if provided)
    if (input.birthDate || input.birthPlace) {
      await tx.insert(events)
        .values({
          personId,
          eventType: 'birth',
          dateOriginal: input.birthDate ?? null,
          dateSort: input.birthDate ? parseDateToSort(input.birthDate) : null,
          placeText: input.birthPlace ?? null,
        })
        .run();
    }

    // Insert 4: death event (if provided)
    if (input.deathDate || input.deathPlace) {
      await tx.insert(events)
        .values({
          personId,
          eventType: 'death',
          dateOriginal: input.deathDate ?? null,
          dateSort: input.deathDate ? parseDateToSort(input.deathDate) : null,
          placeText: input.deathPlace ?? null,
        })
        .run();
    }

    // Insert 5 & 6: family linking (relation-dependent)
    const { relation, ofPersonId } = ctx;
    if (relation && ofPersonId) {
      if (relation === 'spouse') {
        await tx.insert(families)
          .values({
            partner1Id: ofPersonId,
            partner2Id: personId,
          })
          .run();
      } else if (relation === 'father') {
        await findOrCreateFamilyForChild(tx as unknown as Parameters<typeof findOrCreateFamilyForChild>[0], ofPersonId, personId, 'partner1');
      } else if (relation === 'mother') {
        await findOrCreateFamilyForChild(tx as unknown as Parameters<typeof findOrCreateFamilyForChild>[0], ofPersonId, personId, 'partner2');
      } else if (relation === 'child') {
        const partnerFams = await findFamiliesAsPartner(tx as unknown as Parameters<typeof findFamiliesAsPartner>[0], ofPersonId);
        if (partnerFams.length > 0) {
          await tx.insert(children)
            .values({
              familyId: partnerFams[0],
              personId,
            })
            .run();
        } else {
          const famId = crypto.randomUUID();
          await tx.insert(families)
            .values({
              id: famId,
              partner1Id: ofPersonId,
            })
            .run();
          await tx.insert(children)
            .values({
              familyId: famId,
              personId,
            })
            .run();
        }
      } else if (relation === 'sibling') {
        await addSibling(tx as unknown as Parameters<typeof addSibling>[0], ofPersonId, personId);
      }
    }
  });

  return personId;
}
