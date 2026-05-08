import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
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
      // Read the family's configured default privacy level so new persons
      // pick it up automatically. Falls back to 'private' if the family
      // row is somehow missing (matches the historical schema default).
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
      return { personId };
    }),
});
