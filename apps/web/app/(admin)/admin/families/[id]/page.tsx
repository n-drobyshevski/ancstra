import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cacheLife, cacheTag } from 'next/cache';
import { getCentralDb } from '@/lib/db-singleton';
import { getFamilyDetail } from '@ancstra/auth/admin';
import { FamilyDetail } from '@/components/admin/family-detail';
import { Button } from '@/components/ui/button';

async function getCachedFamilyDetail(id: string) {
  'use cache';
  cacheLife('minutes');
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
  const data = await getCachedFamilyDetail(id);
  return { title: data ? `${data.family.name} — Admin` : 'Family not found' };
}

export default async function AdminFamilyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCachedFamilyDetail(id);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/families">
          <ChevronLeft className="size-4" />
          Back to families
        </Link>
      </Button>
      <FamilyDetail data={data} />
    </div>
  );
}
