import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { createThread } from '@ancstra/research';
import type { ThreadStatus } from '@ancstra/research';
import { getCachedThreadList } from '@/lib/research/thread-loaders';

export async function GET(request: Request) {
  try {
    const { ctx } = await withAuth('ai:research', request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ThreadStatus | null;
    const createdBy = searchParams.get('createdBy');
    const q = searchParams.get('q');
    // Route into the cached loader so the response is served from the
    // Next.js Data Cache when the (dbFilename, filters) tuple hasn't
    // changed. Mutations elsewhere already call `revalidateTag('threads-list')`
    // so the cache stays consistent automatically.
    const rows = await getCachedThreadList(ctx.dbFilename, {
      status: status ?? undefined,
      createdBy: createdBy ?? undefined,
      q: q && q.trim().length > 0 ? q.trim() : undefined,
    });
    return NextResponse.json({ threads: rows });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[threads GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const body = await request.json();
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    const thread = await createThread(familyDb, {
      title: body.title,
      seedPersonId: body.seedPersonId,
      seedFactsheetId: body.seedFactsheetId,
      seedResearchItemId: body.seedResearchItemId,
      summary: body.summary,
      createdBy: ctx.userId,
    });
    revalidateTag('threads-list', 'max');
    return NextResponse.json(thread, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[threads POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
