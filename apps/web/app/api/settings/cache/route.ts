import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, researchItems } from '@ancstra/db';
import { eq, sql } from 'drizzle-orm';

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createDb();

  // Count dismissed items before deleting
  const [{ count }] = db
    .select({ count: sql<number>`count(*)` })
    .from(researchItems)
    .where(eq(researchItems.status, 'dismissed'))
    .all();

  // Delete dismissed research items
  db.delete(researchItems)
    .where(eq(researchItems.status, 'dismissed'))
    .run();

  return NextResponse.json({ cleared: count });
}
