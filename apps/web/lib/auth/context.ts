import { headers } from 'next/headers';
import { auth } from '@/auth';
import { parseRole, type Role } from '@ancstra/auth';
import { eq, and } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { getCentralDb } from '@/lib/db-singleton';
import { resolveEffectiveRole } from '@/lib/auth/effective-role-from-cookie';

export interface AuthContext {
  userId: string;
  familyId: string;
  /**
   * Effective role for permission decisions. Equal to `actualRole` unless the
   * user has activated a lens cookie that legitimately downgrades their role
   * for the current family. Mirrors the tRPC `BaseContext.role` semantics.
   */
  role: Role;
  /**
   * Real role from the JWT membership (or DB fallback), untouched by any lens.
   * Use only for UI affordances that need the user's true role (e.g. the lens
   * selector itself). Never use for permission decisions.
   */
  actualRole: Role;
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
  // Cookie is read once and threaded through both code paths so the lens
  // applies whether we resolved via JWT or via the DB fallback.
  const cookieHeader = headerStore.get('cookie');

  // Always derive role from JWT memberships — never from x-family-role header (sub-spec A D2)
  const session = await auth();
  const memberships = session?.user?.memberships ?? [];
  let membership: (typeof memberships)[number] | undefined;
  if (familyIdHint) {
    membership = memberships.find((m) => m.familyId === familyIdHint);
  } else if (memberships.length === 1) {
    // Single membership = unambiguous default
    membership = memberships[0];
  } else if (memberships.length > 1) {
    // Multiple memberships and no hint — caller must specify which family.
    // Production proxy always sets x-family-id; this branch surfaces test-harness
    // bugs and non-proxied callers. Returning null forces the caller to be explicit.
    console.warn('[AUTH] getAuthContext called without x-family-id but user has multiple memberships', {
      userId,
      membershipCount: memberships.length,
    });
    return null;
  }

  if (membership) {
    const actualRole = parseRole(membership.role);
    if (actualRole) {
      return {
        userId,
        familyId: membership.familyId,
        role: resolveEffectiveRole(actualRole, membership.familyId, cookieHeader),
        actualRole,
        dbFilename: membership.dbFilename,
      };
    }
    // Failed to parse — could be JWT tampering or a role enum that hasn't been added
    // to VALID_ROLES yet. Log + fall through to DB to verify.
    console.warn('[AUTH] JWT membership.role failed parseRole — falling through to DB', {
      userId,
      familyId: membership.familyId,
      role: membership.role,
    });
  }

  // Fallback: stale JWT (user just accepted invite, JWT not yet refreshed) — query DB
  return dbFallback(userId, familyIdHint, dbFilenameHint, cookieHeader);
}

async function dbFallback(
  userId: string,
  familyIdHint: string | null,
  dbFilenameHint: string | null,
  cookieHeader: string | null,
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

  const actualRole = parseRole(membership.role);
  if (!actualRole) return null;

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
    role: resolveEffectiveRole(actualRole, resolvedFamilyId, cookieHeader),
    actualRole,
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
