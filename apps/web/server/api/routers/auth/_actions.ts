'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { acceptInvite, logActivity, type ActivityAction } from '@ancstra/auth';
import { authedFormAction } from '../../trpc';
import { invalidateTags } from '../../cache';

export const acceptInviteAction = authedFormAction
  .meta({ span: 'auth.acceptInvite' })
  .input(z.object({ token: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const result = await acceptInvite(ctx.centralDb, input.token, ctx.userId);
    await logActivity(ctx.centralDb, {
      familyId: result.familyId,
      userId: ctx.userId,
      action: 'invite_accepted' as ActivityAction,
      summary: 'Joined the family',
    });
    invalidateTags(['activity']);
    redirect(`/dashboard?family=${result.familyId}&invite=accepted`);
  });
