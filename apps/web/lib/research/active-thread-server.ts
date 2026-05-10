import { cookies } from 'next/headers';

const COOKIE_PREFIX = 'act-thread-';

/**
 * Read the active-thread id from cookies (server-side, Route Handlers).
 * Mirrors the cookie name set by `PUT /api/research/threads/active`.
 * Returns `null` when no active thread is set for the family.
 */
export async function getActiveThreadIdFromCookies(familyId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const c = cookieStore.get(`${COOKIE_PREFIX}${familyId}`);
  return c?.value ?? null;
}
