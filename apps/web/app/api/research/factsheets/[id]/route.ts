import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { getFactsheet, updateFactsheet, deleteFactsheet } from '@ancstra/research';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;

    const result = await getFactsheet(familyDb, id);
    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id] GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;
    const body = await request.json();

    const result = await updateFactsheet(familyDb, id, {
      title: body.title,
      notes: body.notes,
      status: body.status,
    });

    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    revalidateTag('factsheets-list', 'max');
    revalidateTag(`factsheet-${id}`, 'max');
    revalidateTag('factsheet-count', 'max');

    return NextResponse.json(result);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id] PUT]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;

    await deleteFactsheet(familyDb, id);

    revalidateTag('factsheets-list', 'max');
    revalidateTag(`factsheet-${id}`, 'max');
    revalidateTag('factsheet-count', 'max');
    revalidateTag('factsheet-links', 'max');

    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id] DELETE]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
