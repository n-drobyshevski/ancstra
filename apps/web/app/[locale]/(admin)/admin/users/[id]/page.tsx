import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cacheLife, cacheTag } from 'next/cache';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCentralDb } from '@/lib/db-singleton';
import { getUserDetail, userExists } from '@ancstra/auth/admin';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { UserDetail } from '@/components/admin/user-detail';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/routing';

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
  params: Promise<{ id: string; locale: Locale }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.users' });
  const db = await getCentralDb();
  if (!(await userExists(db, id))) {
    return { title: t('notFound') };
  }
  const data = await getCachedUserDetail(id);
  return { title: data ? t('metadataSuffix', { name: data.user.name }) : t('notFound') };
}

interface AdminUserDetailPageProps {
  params: Promise<{ id: string; locale: Locale }>;
}

async function AdminUserDetailContent({ params }: AdminUserDetailPageProps) {
  const { id, locale } = await params;
  setRequestLocale(locale);
  const viewer = await requirePlatformAdmin();
  const db = await getCentralDb();
  if (!(await userExists(db, id))) notFound();
  const data = await getCachedUserDetail(id);
  if (!data) notFound();

  const t = await getTranslations('admin.users.detail');

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/users">
          <ChevronLeft className="size-4" />
          {t('back')}
        </Link>
      </Button>
      <UserDetail data={data} viewerUserId={viewer.userId} />
    </div>
  );
}

export default function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  return (
    <Suspense fallback={null}>
      <AdminUserDetailContent params={params} />
    </Suspense>
  );
}
