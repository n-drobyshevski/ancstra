import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { researchItems } from '@ancstra/db';
import { eq, sql } from 'drizzle-orm';

export async function DELETE() {
  try {
    const { familyDb } = await withAuth('settings:manage');

    // Count dismissed items before deleting
    const [{ count }] = familyDb
      .select({ count: sql<number>`count(*)` })
      .from(researchItems)
      .where(eq(researchItems.status, 'dismissed'))
      .all();

    // Delete dismissed research items
    familyDb.delete(researchItems)
      .where(eq(researchItems.status, 'dismissed'))
      .run();

    return NextResponse.json({ cleared: count });
  } catch (error) {
    return handleAuthError(error);
  }
}
