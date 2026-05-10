import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { cascade } from '@ancstra/research';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const { id: threadId } = await params;
    const body = await request.json();

    if (!body.sourceFactsheetId || !body.sourceFactId || !body.newFactsheetTitle || !body.relationshipType) {
      return NextResponse.json(
        { error: 'sourceFactsheetId, sourceFactId, newFactsheetTitle, relationshipType are required' },
        { status: 400 }
      );
    }
    if (!['parent_child', 'spouse', 'sibling'].includes(body.relationshipType)) {
      return NextResponse.json({ error: 'invalid relationshipType' }, { status: 400 });
    }

    const result = await cascade(familyDb, {
      threadId,
      sourceFactsheetId: body.sourceFactsheetId,
      sourceFactId: body.sourceFactId,
      newFactsheetTitle: body.newFactsheetTitle,
      relationshipType: body.relationshipType,
      reason: body.reason ?? 'cascade',
      actorId: ctx.userId,
      confidence: body.confidence,
    });

    revalidateTag('factsheets-list', 'max');
    revalidateTag('factsheet-count', 'max');
    revalidateTag(`thread:${threadId}`, 'max');

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[thread cascade POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
