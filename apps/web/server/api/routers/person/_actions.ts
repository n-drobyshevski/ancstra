'use server';

import { redirect } from 'next/navigation';
import { formAction } from '../../trpc';
import { invalidateTags } from '../../cache';
import { insertRelatedPerson } from './_logic';
import { PERSON_MUTATION_TAGS, createRelatedPersonSchema } from './_shared';

export const createRelatedPerson = formAction
  .meta({ permission: 'person:create', span: 'person.createRelated' })
  .input(createRelatedPersonSchema)
  .mutation(async ({ ctx, input }) => {
    const { relation, ofPersonId, ...personInput } = input;
    const personId = await insertRelatedPerson(
      ctx.familyDb!,
      personInput,
      { relation: relation ?? null, ofPersonId: ofPersonId ?? null },
      ctx.userId,
    );
    invalidateTags(PERSON_MUTATION_TAGS);
    redirect(ofPersonId ? `/persons/${ofPersonId}` : `/persons/${personId}`);
  });
