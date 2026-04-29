'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod/v3';
import { formAction } from '../../trpc';
import { invalidateTags } from '../../cache';
import { createPersonSchema } from '@/lib/validation';
import { insertRelatedPerson } from './_logic';

const createRelatedPersonSchema = createPersonSchema.extend({
  relation: z.string().nullable().optional(),
  ofPersonId: z.string().nullable().optional(),
});

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
    invalidateTags(['persons', 'tree-data', 'dashboard']);
    redirect(ofPersonId ? `/persons/${ofPersonId}` : `/persons/${personId}`);
  });
