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
 * Get the authenticated user's context from proxy headers.
 * Call this in API routes or server components.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');
  const familyId = headersList.get('x-family-id');

  if (!userId) return null;

  const centralDb = createCentralDb();

  // If no family specified, find the user's first family
  let resolvedFamilyId = familyId;
  if (!resolvedFamilyId) {
    const firstMembership = await centralDb
      .select()
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

  // Get membership to determine role
  const membership = await centralDb
    .select()
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

  // Get family registry for db filename
  const family = await centralDb
    .select()
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
export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    throw new Error('Not authenticated or no family membership');
  }
  return ctx;
}
