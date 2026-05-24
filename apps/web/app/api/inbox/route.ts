import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { listInboxItems, countInboxItems } from '@ancstra/research';
import type { InboxItemType } from '@ancstra/research';

const VALID_TYPES = new Set(['factsheet_draft', 'ai_proposal', 'conflict', 'hint']);

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const url = new URL(request.url);

    const typeParam = url.searchParams.get('type');
    let typeFilter: InboxItemType | InboxItemType[] | undefined;
    if (typeParam) {
      const parts = typeParam.split(',').map(s => s.trim()).filter(s => VALID_TYPES.has(s));
      if (parts.length === 1) typeFilter = parts[0] as InboxItemType;
      else if (parts.length > 1) typeFilter = parts as InboxItemType[];
    }

    const threadParam = url.searchParams.get('threadId');
    const threadFilter = threadParam === 'untriaged' ? 'untriaged' : threadParam || undefined;

    const personId = url.searchParams.get('personId') || undefined;
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50));

    const [items, counts] = await Promise.all([
      listInboxItems(familyDb, { type: typeFilter, threadId: threadFilter, personId, offset, limit }),
      countInboxItems(familyDb, { threadId: threadFilter, personId }),
    ]);

    const filteredTotal = typeFilter
      ? (Array.isArray(typeFilter) ? typeFilter : [typeFilter])
          .reduce((sum, t) => sum + (counts.byType[t] ?? 0), 0)
      : counts.total;

    return NextResponse.json({
      items,
      counts,
      hasMore: offset + items.length < filteredTotal,
    });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[api/inbox GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
