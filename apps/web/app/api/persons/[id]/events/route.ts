import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, events } from '@ancstra/db';
import { eq, sql } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = createDb();

  const personEvents = db
    .select()
    .from(events)
    .where(eq(events.personId, id))
    .orderBy(sql`${events.dateSort} ASC NULLS LAST`)
    .all();

  return NextResponse.json(personEvents);
}
