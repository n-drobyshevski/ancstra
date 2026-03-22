import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
import { resolveConflict } from '@ancstra/research';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { winnerFactId, loserFactId } = body;

  if (!winnerFactId || !loserFactId) {
    return NextResponse.json(
      { error: 'Validation failed: winnerFactId and loserFactId are required' },
      { status: 400 },
    );
  }

  const db = createDb();
  resolveConflict(db, winnerFactId, loserFactId);

  return NextResponse.json({ success: true });
}
