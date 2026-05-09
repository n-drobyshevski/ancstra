import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cacheLife, cacheTag } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { getCentralDb } from '@/lib/db-singleton';
import { familyExists, getFamilyDetail } from '@ancstra/auth/admin';
import { FamilyDetail } from '@/components/admin/family-detail';
import { Button } from '@/components/ui/button';

async function getCachedFamilyDetail(id: string) {
  'use cache';
  cacheLife('seconds');
  cacheTag(`platform-family:${id}`);
  const db = await getCentralDb();
  return getFamilyDetail(db, id);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations('admin.families');
  const db = await getCentralDb();
  if (!(await familyExists(db, id))) {
    return { title: t('notFound') };
  }
  const data = await getCachedFamilyDetail(id);
  return { title: data ? t('metadataSuffix', { name: data.family.name }) : t('notFound') };
}

interface AdminFamilyDetailPageProps {
  params: Promise<{ id: string }>;
}

async function AdminFamilyDetailContent({ params }: AdminFamilyDetailPageProps) {
  const { id } = await params;
  const db = await getCentralDb();
  if (!(await familyExists(db, id))) notFound();
  const data = await getCachedFamilyDetail(id);
  if (!data) notFound();

  const t = await getTranslations('admin.families.detail');

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/families">
          <ChevronLeft className="size-4" />
          {t('back')}
        </Link>
      </Button>
      <FamilyDetail data={data} />
    </div>
  );
}

export default function AdminFamilyDetailPage({ params }: AdminFamilyDetailPageProps) {
  return (
    <Suspense fallback={null}>
      <AdminFamilyDetailContent params={params} />
    </Suspense>
  );
}
