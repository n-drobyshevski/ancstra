import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { countInboxItems } from '@ancstra/research';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const url = new URL(request.url);
    const threadParam = url.searchParams.get('threadId');
    const threadFilter = threadParam === 'untriaged' ? 'untriaged' : threadParam || undefined;
    const personId = url.searchParams.get('personId') || undefined;

    const counts = await countInboxItems(familyDb, { threadId: threadFilter as any, personId });
    return NextResponse.json({ counts });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[api/inbox/count GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
