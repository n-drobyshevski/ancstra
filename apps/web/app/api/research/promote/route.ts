import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { promoteToSource } from '@ancstra/research';

export async function POST(request: Request) {
  try {
    const { ctx, familyDb } = await withAuth('ai:research');

    let body: { researchItemId?: string; personId?: string; citationText?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.researchItemId || !body.personId) {
      return NextResponse.json(
        { error: 'researchItemId and personId are required' },
        { status: 400 },
      );
    }

    try {
      const result = await promoteToSource(familyDb, {
        researchItemId: body.researchItemId,
        personId: body.personId,
        userId: ctx.userId,
        citationText: body.citationText,
      });

      return NextResponse.json(result);
    } catch (err: any) {
      const message: string = err?.message ?? 'Unknown error';

      if (/not found/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (/already promoted/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 409 });
      }

      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/promote POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
