import { z } from 'zod';
import { createFamily } from '@ancstra/auth';
import { createTRPCRouter, authenticatedProcedure } from '../trpc';

export const familyRouter = createTRPCRouter({
  create: authenticatedProcedure
    .input(z.object({ name: z.string().trim().min(1, 'Family name is required') }))
    .mutation(async ({ ctx, input }) => {
      const { familyId } = await createFamily(ctx.centralDb, {
        name: input.name,
        ownerId: ctx.userId,
      });
      // TODO(sub-spec-A): bump users.memberships_version once the column exists
      return { familyId };
    }),
});
