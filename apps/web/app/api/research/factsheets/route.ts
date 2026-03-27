import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { createFactsheet, listFactsheets, listFactsheetsWithCounts } from '@ancstra/research';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { searchParams } = new URL(request.url);

    const filters = {
      status: searchParams.get('status') ?? undefined,
      createdBy: searchParams.get('createdBy') ?? undefined,
      personId: searchParams.get('personId') ?? undefined,
    };

    const include = searchParams.get('include');
    const rows = include === 'counts'
      ? await listFactsheetsWithCounts(familyDb, filters)
      : await listFactsheets(familyDb, filters);

    return NextResponse.json({ factsheets: rows });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research');
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const result = await createFactsheet(familyDb, {
      title: body.title,
      entityType: body.entityType,
      notes: body.notes,
      createdBy: ctx.userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
