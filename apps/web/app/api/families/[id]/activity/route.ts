import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/context';
import { requirePermission, getActivityFeed, redactActivityForViewer } from '@ancstra/auth';
import { createCentralDb } from '@ancstra/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: familyId } = await params;
  const ctx = await requireAuthContext();
  requirePermission(ctx.role, 'activity:view');

  const centralDb = createCentralDb();
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const action = url.searchParams.get('action') || undefined;
  const userId = url.searchParams.get('userId') || undefined;

  const feed = await getActivityFeed(centralDb, { familyId, cursor, limit, action, userId });

  if (ctx.role === 'viewer') {
    // TODO: populate livingPersonIds from family DB when routes are fully integrated
    feed.items = redactActivityForViewer(feed.items, new Set());
  }

  return NextResponse.json(feed);
}
