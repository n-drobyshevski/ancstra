'use server';

import { getAuthContext } from '@/lib/auth/context';
import { getCachedPersonDetail, getCachedCitationCount } from '@/lib/cache/person';

export async function fetchPersonDetailAction(personId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error('Unauthorized');

  const [detail, citationCount] = await Promise.all([
    getCachedPersonDetail(ctx.dbFilename, personId),
    getCachedCitationCount(ctx.dbFilename, personId),
  ]);

  return { detail, citationCount };
}
