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
export async function withOptimisticLock(
  db: any,
  table: any,
  id: string,
  expectedVersion: number,
  updates: Record<string, unknown>,
): Promise<{ success: boolean; current?: any }> {
  const now = new Date().toISOString();
  const result = await db
    .update(table)
    .set({
      ...updates,
      version: expectedVersion + 1,
      updatedAt: now,
    })
    .where(and(eq(table.id, id), eq(table.version, expectedVersion)))
    .run();

  // Handle both better-sqlite3 (result.changes) and libsql (result.rowsAffected) drivers
  const rowsChanged = result.changes ?? result.rowsAffected ?? 0;
  if (rowsChanged === 0) {
    const current = await db.select().from(table).where(eq(table.id, id)).get();
    return { success: false, current };
  }
  return { success: true };
}

/**
 * Measure async operation duration and warn if slow (>500ms).
 */
export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  if (duration > 500) {
    console.warn(`[SLOW] ${label}: ${duration.toFixed(0)}ms`);
  }
  return result;
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
