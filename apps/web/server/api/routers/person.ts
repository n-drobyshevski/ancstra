import { z } from 'zod';
import { z as z3 } from 'zod/v3';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { invalidateTags } from '../cache';
import { getCachedPersonDetail, getCachedCitationCount } from '@/lib/cache/person';
import { createPersonSchema } from '@/lib/validation';
import { insertRelatedPerson } from './person/_logic';

// Extend the v3 schema with relation context fields using .extend() (same zod version).
const createRelatedPersonSchema = createPersonSchema.extend({
  relation: z3.string().nullable().optional(),
  ofPersonId: z3.string().nullable().optional(),
});

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
      invalidateTags(['persons', 'tree-data', 'dashboard']);
      return { personId };
    }),
});
