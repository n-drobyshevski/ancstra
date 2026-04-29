import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { getCachedPersonDetail, getCachedCitationCount } from '@/lib/cache/person';

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
});
