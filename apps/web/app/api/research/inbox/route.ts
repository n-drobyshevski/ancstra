import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { listUnanchoredItems, getUnanchoredCount } from '@ancstra/research';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const { searchParams } = new URL(request.url);

    // Count-only mode for badge
    if (searchParams.get('count') === 'true') {
      const count = await getUnanchoredCount(familyDb);
      return NextResponse.json({ count });
    }

    const limit = Number(searchParams.get('limit') ?? 50);
    const offset = Number(searchParams.get('offset') ?? 0);

    const items = await listUnanchoredItems(familyDb, { limit, offset });
    const count = await getUnanchoredCount(familyDb);

    return NextResponse.json({ items, total: count });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[research/inbox GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
