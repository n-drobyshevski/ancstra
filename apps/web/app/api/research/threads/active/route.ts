import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { getThread } from '@ancstra/research';

const cookieName = (familyId: string) => `act-thread-${familyId}`;

export async function GET(request: Request) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const cookieHeader = request.headers.get('cookie') ?? '';
    const match = cookieHeader.match(new RegExp(`${cookieName(ctx.familyId)}=([^;]+)`));
    if (!match) return NextResponse.json({ thread: null });
    const thread = await getThread(familyDb, match[1]);
    if (!thread || thread.status !== 'active') return NextResponse.json({ thread: null });
    return NextResponse.json({ thread });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[active-thread GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const body = await request.json();
    const threadId: string | null = body.threadId ?? null;

    // Resolve the new thread up-front so the client can read it directly
    // from the PUT response — saves a follow-up GET /threads/:id on
    // every switcher click (was 2 round-trips, now 1).
    let thread = null;
    if (threadId) {
      thread = await getThread(familyDb, threadId);
      if (!thread) return NextResponse.json({ error: 'thread not found' }, { status: 404 });
    }

    const res = NextResponse.json({ threadId, thread });
    const name = cookieName(ctx.familyId);
    if (threadId) {
      res.cookies.set(name, threadId, {
        httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
        path: '/', maxAge: 60 * 60 * 24 * 30,
      });
    } else {
      res.cookies.set(name, '', { path: '/', maxAge: 0 });
    }
    return res;
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[active-thread PUT]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
