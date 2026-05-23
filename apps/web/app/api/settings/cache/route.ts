import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { researchItems } from '@ancstra/db';
import { eq, sql } from 'drizzle-orm';

export async function DELETE(request: Request) {
  try {
    const { familyDb } = await withAuth('settings:manage', request);

    // Count discarded items before deleting
    const [{ count }] = await familyDb
      .select({ count: sql<number>`count(*)` })
      .from(researchItems)
      .where(eq(researchItems.status, 'discarded'))
      .all();

    // Delete discarded research items
    await familyDb.delete(researchItems)
      .where(eq(researchItems.status, 'discarded'))
      .run();

    return NextResponse.json({ cleared: count });
  } catch (error) {
    return handleAuthError(error);
  }
}
