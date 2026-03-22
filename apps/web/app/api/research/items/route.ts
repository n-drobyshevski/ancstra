import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
import {
  createResearchItem,
  listResearchItems,
} from '@ancstra/research';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'draft' | 'promoted' | 'dismissed' | null;
    const personId = searchParams.get('personId');

    const db = createDb();
    const filters: Record<string, string> = {};
    if (status) filters.status = status;
    if (personId) filters.personId = personId;

    const items = listResearchItems(db, Object.keys(filters).length > 0 ? filters : undefined);

    return NextResponse.json({ items });
  } catch (err) {
    console.error('[research/items GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.title || !body.discoveryMethod) {
    return NextResponse.json(
      { error: 'Validation failed: title and discoveryMethod are required' },
      { status: 400 }
    );
  }

  const db = createDb();
  const result = createResearchItem(db, {
    ...body,
    createdBy: session.user.id,
  });

  return NextResponse.json(result, { status: 201 });
}
