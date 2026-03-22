'use server';

import { acceptInvite } from '@ancstra/auth';
import { createCentralDb } from '@ancstra/db';
import { redirect } from 'next/navigation';

export async function acceptInviteAction(token: string, userId: string) {
  const centralDb = createCentralDb();
  const result = await acceptInvite(centralDb, token, userId);
  if (result) {
    redirect(`/dashboard?family=${result.familyId}`);
  }
  throw new Error('Failed to accept invitation');
}
