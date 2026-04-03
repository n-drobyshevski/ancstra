import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/context';
import { requirePermission, getActivityFeed, redactActivityForViewer } from '@ancstra/auth';
import { createCentralDb } from '@ancstra/db';
import { users } from '@ancstra/db/central-schema';
import { inArray } from 'drizzle-orm';

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

  const uniqueUserIds = [...new Set(feed.items.map((item) => item.userId).filter(Boolean))] as string[];

  const userRows =
    uniqueUserIds.length > 0
      ? await centralDb.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, uniqueUserIds))
      : [];

  const userMap = new Map(userRows.map((u) => [u.id, { name: u.name, avatarUrl: u.avatarUrl }]));

  const enrichedItems = feed.items.map((item) => {
    const resolved = item.userId ? userMap.get(item.userId) : undefined;
    return {
      ...item,
      userName: resolved?.name ?? 'Unknown',
      userAvatarUrl: resolved?.avatarUrl ?? null,
    };
  });

  return NextResponse.json({ ...feed, items: enrichedItems });
}
