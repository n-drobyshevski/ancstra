import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
import { detectConflicts } from '@ancstra/research';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get('personId');

  if (!personId) {
    return NextResponse.json(
      { error: 'personId query parameter is required' },
      { status: 400 },
    );
  }

  const db = createDb();
  const conflicts = detectConflicts(db, personId);

  return NextResponse.json({ conflicts });
}
