import { NextResponse } from 'next/server';
import { requireAuthContext, type AuthContext } from './context';
import {
  requirePermission,
  shouldModerate,
  submitContribution,
  logActivity,
  ForbiddenError,
  type Permission,
  type ActivityAction,
} from '@ancstra/auth';
import { createFamilyDb, createCentralDb } from '@ancstra/db';
import { eq, and } from 'drizzle-orm';

/**
 * Wrap an API handler with auth context and permission check.
 * Returns the auth context and family DB connection.
 */
export async function withAuth(permission: Permission) {
  const ctx = await requireAuthContext();
  requirePermission(ctx.role, permission);
  const familyDb = createFamilyDb(ctx.dbFilename);
  const centralDb = createCentralDb();
  return { ctx, familyDb, centralDb };
}

/**
 * Perform an optimistic-locked update.
 * Returns 409 with current data if version conflicts.
 */
export function withOptimisticLock(
  db: any,
  table: any,
  id: string,
  expectedVersion: number,
  updates: Record<string, unknown>,
): { success: boolean; current?: any } {
  const now = new Date().toISOString();
  const result = db
    .update(table)
    .set({
      ...updates,
      version: expectedVersion + 1,
      updatedAt: now,
    })
    .where(and(eq(table.id, id), eq(table.version, expectedVersion)))
    .run();

  if (result.changes === 0) {
    const current = db.select().from(table).where(eq(table.id, id)).get();
    return { success: false, current };
  }
  return { success: true };
}

/**
 * Handle errors from auth/permission checks in API routes.
 */
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof Error && error.message.includes('Not authenticated')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  throw error;
}
