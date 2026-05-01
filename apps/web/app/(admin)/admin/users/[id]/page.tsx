import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getCentralDb } from '@/lib/db-singleton';
import { getUserDetail } from '@ancstra/auth/admin';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { UserDetail } from '@/components/admin/user-detail';
import { Button } from '@/components/ui/button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getCentralDb();
  const data = await getUserDetail(db, id);
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
  const data = await getUserDetail(db, id);
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
