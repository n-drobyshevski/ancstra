import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { auth } from '@/auth';
import { getCentralDb } from '@/lib/db-singleton';
import { LENS_COOKIE_NAME, parseLensCookie } from '@/lib/lens/cookie';

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
 *
 * Lens-aware: if ANY family-scoped lens cookie is active, this returns null
 * even for real platform admins. Rationale — the lens promise is "show me
 * what a lower-role user would see", and lower-role users get a 404 from
 * /admin/*. Returning null here makes `requirePlatformAdmin` notFound()
 * uniformly. The matching client-side check lives in
 * `<PlatformAdminOnly>` (`components/auth/platform-admin-only.tsx`).
 *
 * The check uses `parseLensCookie` only — it does NOT validate the cookie's
 * familyId against memberships, because /admin/* is family-agnostic. The
 * mere presence of a parseable lens cookie signals user intent to view as
 * lower role; a lensed user can exit via the sidebar banner or selector.
 */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  const cookieStore = await cookies();
  const lensRaw = cookieStore.get(LENS_COOKIE_NAME)?.value ?? null;
  if (parseLensCookie(lensRaw)) return null;

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
    .where(
      and(
        eq(centralSchema.users.id, session.user.id),
        isNull(centralSchema.users.deletedAt),
      ),
    )
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
