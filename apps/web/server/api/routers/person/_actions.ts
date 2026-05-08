'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { protectedFormAction } from '../../trpc';
import { invalidateTags } from '../../cache';
import { insertRelatedPerson } from './_logic';
import { PERSON_MUTATION_TAGS, createRelatedPersonSchema } from './_shared';

export const createRelatedPerson = protectedFormAction
  .meta({ permission: 'person:create', span: 'person.createRelated' })
  .input(createRelatedPersonSchema)
  .mutation(async ({ ctx, input }) => {
    const { relation, ofPersonId, ...personInput } = input;
    // Mirror person.createRelated tRPC procedure: pick up the family's
    // configured default privacy level for new persons.
    const family = await ctx.centralDb
      .select({ defaultPrivacyLevel: centralSchema.familyRegistry.defaultPrivacyLevel })
      .from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, ctx.familyId!))
      .get();
    const personId = await insertRelatedPerson(
      ctx.familyDb!,
      personInput,
      { relation: relation ?? null, ofPersonId: ofPersonId ?? null },
      ctx.userId,
      family?.defaultPrivacyLevel ?? 'private',
    );
    invalidateTags(PERSON_MUTATION_TAGS);
    redirect(ofPersonId ? `/persons/${ofPersonId}` : `/persons/${personId}`);
  });
