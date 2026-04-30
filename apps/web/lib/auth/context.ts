import { headers } from 'next/headers';
import { auth } from '@/auth';
import { parseRole, type Role } from '@ancstra/auth';
import { eq, and } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { getCentralDb } from '@/lib/db-singleton';

export interface AuthContext {
  userId: string;
  familyId: string;
  role: Role;
  dbFilename: string;
}

/**
 * Get the authenticated user's context.
 *
 * Role is always derived from JWT memberships — never from the x-family-role
 * header (sub-spec A D2). The header is untrusted; only the signed JWT is authoritative.
 *
 * Fallback path: if the JWT is stale (e.g. just-joined family not yet in the
 * token), we query the central DB. Becomes a no-op once the user signs in again
 * or triggers a session refresh.
 *
 * Pass `request` from route handlers to avoid async headers() — prevents
 * HANGING_PROMISE_REJECTION warnings during Next.js prerendering.
 */
export async function getAuthContext(request?: Request): Promise<AuthContext | null> {
  const headerStore = request?.headers ?? await headers();
  const userId = headerStore.get('x-user-id');
  if (!userId) return null;

  const familyIdHint = headerStore.get('x-family-id');
  const dbFilenameHint = headerStore.get('x-family-db');

  // Always derive role from JWT memberships — never from x-family-role header (sub-spec A D2)
  const session = await auth();
  const memberships = session?.user?.memberships ?? [];
  const membership = familyIdHint
    ? memberships.find((m) => m.familyId === familyIdHint)
    : memberships[0];

  if (membership) {
    const role = parseRole(membership.role);
    if (role) {
      return {
        userId,
        familyId: membership.familyId,
        role,
        dbFilename: membership.dbFilename,
      };
    }
  }

  // Fallback: stale JWT (user just accepted invite, JWT not yet refreshed) — query DB
  return dbFallback(userId, familyIdHint, dbFilenameHint);
}

async function dbFallback(
  userId: string,
  familyIdHint: string | null,
  dbFilenameHint: string | null,
): Promise<AuthContext | null> {
  const centralDb = await getCentralDb();

  let resolvedFamilyId = familyIdHint;
  if (!resolvedFamilyId) {
    const firstMembership = await centralDb
      .select({ familyId: centralSchema.familyMembers.familyId })
      .from(centralSchema.familyMembers)
      .where(
        and(
          eq(centralSchema.familyMembers.userId, userId),
          eq(centralSchema.familyMembers.isActive, 1),
        )
      )
      .limit(1)
      .get();
    if (!firstMembership) return null;
    resolvedFamilyId = firstMembership.familyId;
  }

  const membership = await centralDb
    .select({ role: centralSchema.familyMembers.role })
    .from(centralSchema.familyMembers)
    .where(
      and(
        eq(centralSchema.familyMembers.userId, userId),
        eq(centralSchema.familyMembers.familyId, resolvedFamilyId),
        eq(centralSchema.familyMembers.isActive, 1),
      )
    )
    .get();
  if (!membership) return null;

  const role = parseRole(membership.role);
  if (!role) return null;

  let resolvedDbFilename = dbFilenameHint;
  if (!resolvedDbFilename) {
    const family = await centralDb
      .select({ dbFilename: centralSchema.familyRegistry.dbFilename })
      .from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, resolvedFamilyId))
      .get();
    if (!family) return null;
    resolvedDbFilename = family.dbFilename;
  }

  return {
    userId,
    familyId: resolvedFamilyId,
    role,
    dbFilename: resolvedDbFilename,
  };
}

/**
 * Require auth context — throws if not authenticated.
 */
export async function requireAuthContext(request?: Request): Promise<AuthContext> {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    throw new Error('Not authenticated or no family membership');
  }
  return ctx;
}
