import { headers } from 'next/headers';
import { createCentralDb } from '@ancstra/db';
import { centralSchema } from '@ancstra/db';
import { eq, and } from 'drizzle-orm';
import type { Role } from '@ancstra/auth';

export interface AuthContext {
  userId: string;
  familyId: string;
  role: Role;
  dbFilename: string;
}

/**
 * Get the authenticated user's context.
 *
 * Hot path: every value is set as a request header by the proxy from the
 * JWT-embedded memberships map — pure header read, no DB calls.
 *
 * Fallback path: if the JWT is stale (e.g. just-joined family not yet in the
 * token), the proxy passes only `x-family-id` and we look up role + dbFilename
 * from the central DB. Becomes a no-op once the user signs in again or
 * triggers a session refresh.
 *
 * Pass `request` from route handlers to avoid async headers() — prevents
 * HANGING_PROMISE_REJECTION warnings during Next.js prerendering.
 */
export async function getAuthContext(request?: Request): Promise<AuthContext | null> {
  const headersList = request ? request.headers : await headers();
  const userId = headersList.get('x-user-id');
  if (!userId) return null;

  const familyId = headersList.get('x-family-id');
  const role = headersList.get('x-family-role');
  const dbFilename = headersList.get('x-family-db');

  // Fast path: proxy populated everything from the JWT
  if (familyId && role && dbFilename) {
    return { userId, familyId, role: role as Role, dbFilename };
  }

  // Fallback: stale token or first request post-membership-change.
  // Resolve from the central DB using only the columns we need.
  const centralDb = createCentralDb();

  let resolvedFamilyId = familyId;
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

  const family = await centralDb
    .select({ dbFilename: centralSchema.familyRegistry.dbFilename })
    .from(centralSchema.familyRegistry)
    .where(eq(centralSchema.familyRegistry.id, resolvedFamilyId))
    .get();
  if (!family) return null;

  return {
    userId,
    familyId: resolvedFamilyId,
    role: membership.role as Role,
    dbFilename: family.dbFilename,
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
