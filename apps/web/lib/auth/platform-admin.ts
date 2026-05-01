import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { auth } from '@/auth';
import { getCentralDb } from '@/lib/db-singleton';

export interface PlatformAdmin {
  userId: string;
  email: string;
}

/**
 * Read platform-admin status from session, falling back to a single DB read
 * if the JWT claim is missing (post-toggle staleness window).
 *
 * Mirrors the dbFallback pattern in lib/auth/context.ts (sub-spec A) — the JWT
 * is the fast path, the DB is the source of truth.
 */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const email = session.user.email ?? '';

  if (session.user.isPlatformAdmin) {
    return { userId: session.user.id, email };
  }

  // Fallback: claim missing (e.g. JWT predates the platform-admin column,
  // or user was just promoted and JWT not yet refreshed).
  const db = await getCentralDb();
  const row = await db
    .select({ isPlatformAdmin: centralSchema.users.isPlatformAdmin })
    .from(centralSchema.users)
    .where(eq(centralSchema.users.id, session.user.id))
    .get();
  return row?.isPlatformAdmin === 1
    ? { userId: session.user.id, email }
    : null;
}

/**
 * Page-level guard. Returns 404 (not 403) on miss so non-admins can't
 * detect the existence of /admin routes.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const admin = await getPlatformAdmin();
  if (!admin) notFound();
  return admin;
}
