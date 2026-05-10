import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { addEvent, getThreadTimeline } from '@ancstra/research';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') ?? '200');
    const offset = Number(searchParams.get('offset') ?? '0');
    const events = await getThreadTimeline(familyDb, id, { limit, offset });
    return NextResponse.json({ events });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[thread events GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const { id } = await params;
    const body = await request.json();
    if (typeof body.note !== 'string' || body.note.trim().length === 0) {
      return NextResponse.json({ error: 'note is required' }, { status: 400 });
    }
    const evt = await addEvent(familyDb, {
      threadId: id,
      eventType: 'note_added',
      actorId: ctx.userId,
      reason: body.note,
    });
    revalidateTag(`thread:${id}`, 'max');
    return NextResponse.json(evt, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[thread events POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
