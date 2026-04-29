import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { invalidateTags } from '../cache';
import { getCachedPersonDetail, getCachedCitationCount } from '@/lib/cache/person';
import { insertRelatedPerson } from './person/_logic';
import { PERSON_MUTATION_TAGS, createRelatedPersonSchema } from './person/_shared';

export const personRouter = createTRPCRouter({
  fetchDetail: protectedProcedure
    .meta({ permission: 'tree:view' })
    .input(z.object({ personId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [detail, citationCount] = await Promise.all([
        getCachedPersonDetail(ctx.dbFilename!, input.personId),
        getCachedCitationCount(ctx.dbFilename!, input.personId),
      ]);

      return { detail, citationCount };
    }),

  createRelated: protectedProcedure
    .meta({ permission: 'person:create' })
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
      return { personId };
    }),
});
