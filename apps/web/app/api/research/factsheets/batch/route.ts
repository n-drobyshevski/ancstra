import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { batchDismissFactsheets, batchLinkFactsheets } from '@ancstra/research';

export async function POST(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const body = await request.json();
    const { action, factsheetIds, relationshipType } = body as {
      action: 'dismiss' | 'link';
      factsheetIds: string[];
      relationshipType?: string;
    };

    if (!action || !Array.isArray(factsheetIds) || factsheetIds.length === 0) {
      return NextResponse.json({ error: 'action and factsheetIds required' }, { status: 400 });
    }

    if (action === 'dismiss') {
      await batchDismissFactsheets(familyDb, factsheetIds);
      return NextResponse.json({ dismissed: factsheetIds.length });
    }

    if (action === 'link') {
      if (!relationshipType) {
        return NextResponse.json({ error: 'relationshipType required for link action' }, { status: 400 });
      }
      await batchLinkFactsheets(familyDb, factsheetIds, relationshipType as 'parent_child' | 'spouse' | 'sibling');
      return NextResponse.json({ linked: factsheetIds.length });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets-batch POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
