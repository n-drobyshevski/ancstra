'use server';

import { acceptInvite, logActivity, type ActivityAction } from '@ancstra/auth';
import { createCentralDb } from '@ancstra/db';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

export async function acceptInviteAction(token: string, userId: string) {
  const centralDb = createCentralDb();
  const result = await acceptInvite(centralDb, token, userId);
  if (result) {
    await logActivity(centralDb, {
      familyId: result.familyId,
      userId,
      action: 'invite_accepted' as ActivityAction,
      summary: 'Joined the family',
    });
    revalidateTag('activity');
    redirect(`/dashboard?family=${result.familyId}`);
  }
  throw new Error('Failed to accept invitation');
}
