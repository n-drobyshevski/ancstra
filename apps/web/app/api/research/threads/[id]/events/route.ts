import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { addEvent, getThreadTimelinePage, type ThreadTimelineCursor } from '@ancstra/research';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200);

    const cursorRaw = searchParams.get('cursor');
    let cursor: ThreadTimelineCursor | undefined;
    if (cursorRaw) {
      try {
        const parsed = JSON.parse(Buffer.from(cursorRaw, 'base64').toString('utf8'));
        if (parsed && typeof parsed.occurredAt === 'string' && typeof parsed.id === 'string') {
          cursor = parsed;
        }
      } catch {
        // Malformed cursor — fall through and serve first page rather
        // than 400-ing. Defensive: avoids hard breakage if the client
        // is on an older bundle than the server.
      }
    }

    const page = await getThreadTimelinePage(familyDb, id, { limit, cursor });
    const encodedNextCursor = page.nextCursor
      ? Buffer.from(JSON.stringify(page.nextCursor), 'utf8').toString('base64')
      : null;

    return NextResponse.json({
      events: page.events,
      nextCursor: encodedNextCursor,
    });
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
