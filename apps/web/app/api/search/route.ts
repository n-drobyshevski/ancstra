import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
import { searchPersonsFts } from '@/lib/queries';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q || !q.trim())
    return NextResponse.json(
      { error: 'Query parameter q is required' },
      { status: 400 },
    );

  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get('limit') ?? '10')),
  );
  const db = createDb();
  const persons = searchPersonsFts(db, q, limit);
  return NextResponse.json({ persons });
}
