'use server';

import { createDb, persons, personNames, events, families, children } from '@ancstra/db';
import { createPersonSchema } from '@/lib/validation';
import { parseDateToSort } from '@ancstra/shared';
import { findOrCreateFamilyForChild, findFamiliesAsPartner } from '@/lib/queries';
import { redirect } from 'next/navigation';
import { updateTag } from 'next/cache';
import { auth } from '@/auth';

export async function createRelatedPerson(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const relation = formData.get('relation') as string | null;
  const ofPersonId = formData.get('ofPersonId') as string | null;

  const rawData = {
    givenName: formData.get('givenName') as string,
    surname: formData.get('surname') as string,
    sex: formData.get('sex') as string,
    birthDate: (formData.get('birthDate') as string) || undefined,
    birthPlace: (formData.get('birthPlace') as string) || undefined,
    deathDate: (formData.get('deathDate') as string) || undefined,
    deathPlace: (formData.get('deathPlace') as string) || undefined,
    isLiving: formData.get('isLiving') === 'on' || formData.get('isLiving') === 'true',
    notes: (formData.get('notes') as string) || undefined,
  };

  const parsed = createPersonSchema.safeParse(rawData);
  if (!parsed.success) throw new Error('Validation failed');

  const data = parsed.data;
  const db = createDb();
  const personId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    // Insert person
    await tx.insert(persons)
      .values({
        id: personId,
        sex: data.sex,
        isLiving: data.isLiving,
        notes: data.notes ?? null,
        createdBy: session.user?.id ?? null,
      })
      .run();

    // Insert primary name
    await tx.insert(personNames)
      .values({
        personId,
        givenName: data.givenName,
        surname: data.surname,
        nameType: 'birth',
        isPrimary: true,
      })
      .run();

    // Insert birth event if provided
    if (data.birthDate || data.birthPlace) {
      await tx.insert(events)
        .values({
          personId,
          eventType: 'birth',
          dateOriginal: data.birthDate ?? null,
          dateSort: data.birthDate ? parseDateToSort(data.birthDate) : null,
          placeText: data.birthPlace ?? null,
        })
        .run();
    }

    // Insert death event if provided
    if (data.deathDate || data.deathPlace) {
      await tx.insert(events)
        .values({
          personId,
          eventType: 'death',
          dateOriginal: data.deathDate ?? null,
          dateSort: data.deathDate ? parseDateToSort(data.deathDate) : null,
          placeText: data.deathPlace ?? null,
        })
        .run();
    }

    // Link relationship if context provided
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
      }
    }
  });

  updateTag('persons');
  updateTag('tree-data');
  updateTag('dashboard');
  redirect(ofPersonId ? `/persons/${ofPersonId}` : `/persons/${personId}`);
}
