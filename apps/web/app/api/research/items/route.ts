import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  createResearchItem,
  listResearchItems,
} from '@ancstra/research';

export async function GET(request: Request) {
  try {
    const { ctx, familyDb } = await withAuth('ai:research');

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'draft' | 'promoted' | 'dismissed' | null;
    const personId = searchParams.get('personId');

    const filters: Record<string, string> = {};
    if (status) filters.status = status;
    if (personId) filters.personId = personId;

    const items = await listResearchItems(familyDb, Object.keys(filters).length > 0 ? filters : undefined);

    return NextResponse.json({ items });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/items GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { ctx, familyDb } = await withAuth('ai:research');

    const body = await request.json();

    if (!body.title || !body.discoveryMethod) {
      return NextResponse.json(
        { error: 'Validation failed: title and discoveryMethod are required' },
        { status: 400 }
      );
    }

    const result = await createResearchItem(familyDb, {
      ...body,
      createdBy: ctx.userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/items POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
