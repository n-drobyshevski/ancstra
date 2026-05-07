import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cacheLife, cacheTag } from 'next/cache';
import { getCentralDb } from '@/lib/db-singleton';
import { getUserDetail, userExists } from '@ancstra/auth/admin';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { UserDetail } from '@/components/admin/user-detail';
import { Button } from '@/components/ui/button';

// Cached body — only invoked AFTER an uncached existence check, so this
// function never returns null in practice and a transient null can never
// be baked into the cache. TTL is `seconds` for admin freshness; mutations
// call updateTag('platform-user:<id>') for instant revalidation.
async function getCachedUserDetail(id: string) {
  'use cache';
  cacheLife('seconds');
  cacheTag(`platform-user:${id}`);
  const db = await getCentralDb();
  return getUserDetail(db, id);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getCentralDb();
  if (!(await userExists(db, id))) {
    return { title: 'User not found' };
  }
  const data = await getCachedUserDetail(id);
  return { title: data ? `${data.user.name} — Admin` : 'User not found' };
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requirePlatformAdmin();
  const db = await getCentralDb();
  if (!(await userExists(db, id))) notFound();
  const data = await getCachedUserDetail(id);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/users">
          <ChevronLeft className="size-4" />
          Back to users
        </Link>
      </Button>
      <UserDetail data={data} viewerUserId={viewer.userId} />
    </div>
  );
}
