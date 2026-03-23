import { NextResponse } from 'next/server';
import { events } from '@ancstra/db';
import { eq, sql } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('tree:view');
    const { id } = await params;

    const personEvents = await familyDb
      .select()
      .from(events)
      .where(eq(events.personId, id))
      .orderBy(sql`${events.dateSort} ASC NULLS LAST`)
      .all();

    return NextResponse.json(personEvents);
  } catch (error) {
    return handleAuthError(error);
  }
}
