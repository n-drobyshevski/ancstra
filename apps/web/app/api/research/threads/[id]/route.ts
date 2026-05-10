import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { getThread, updateThread, pauseThread, resolveThread, abandonThread, resumeThread } from '@ancstra/research';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const { id } = await params;
    const thread = await getThread(familyDb, id);
    if (!thread) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(thread);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[thread GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const { id } = await params;
    const body = await request.json();

    // Status transitions go through lifecycle helpers (they emit events)
    const VALID_STATUSES = new Set(['paused', 'resolved', 'abandoned', 'active']);
    if (body.status !== undefined && !VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    if (body.status === 'paused')    await pauseThread(familyDb, id, ctx.userId);
    if (body.status === 'resolved')  await resolveThread(familyDb, id, ctx.userId, body.reason);
    if (body.status === 'abandoned') await abandonThread(familyDb, id, ctx.userId, body.reason);
    if (body.status === 'active')    await resumeThread(familyDb, id, ctx.userId);

    if (body.title !== undefined || body.summary !== undefined) {
      await updateThread(familyDb, id, { title: body.title, summary: body.summary });
    }

    revalidateTag('threads-list', 'max');
    revalidateTag(`thread:${id}`, 'max');
    const fresh = await getThread(familyDb, id);
    return NextResponse.json(fresh);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[thread PATCH]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
