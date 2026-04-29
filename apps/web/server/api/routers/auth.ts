import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { acceptInvite, logActivity, type ActivityAction } from '@ancstra/auth';
import { createTRPCRouter, authenticatedProcedure } from '../trpc';
import { invalidateTags } from '../cache';

export const authRouter = createTRPCRouter({
  acceptInvite: authenticatedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      let result: Awaited<ReturnType<typeof acceptInvite>>;
      try {
        result = await acceptInvite(ctx.centralDb, input.token, ctx.userId);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Failed to accept invitation' });
      }
      await logActivity(ctx.centralDb, {
        familyId: result.familyId,
        userId: ctx.userId,
        action: 'invite_accepted' as ActivityAction,
        summary: 'Joined the family',
      });
      invalidateTags(['activity']);
      // TODO(sub-spec-A): bump users.memberships_version once the column exists
      return { familyId: result.familyId };
    }),
});
