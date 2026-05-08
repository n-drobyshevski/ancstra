import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cacheLife, cacheTag } from 'next/cache';
import { getCentralDb } from '@/lib/db-singleton';
import { familyExists, getFamilyDetail } from '@ancstra/auth/admin';
import { FamilyDetail } from '@/components/admin/family-detail';
import { Button } from '@/components/ui/button';

// Cached body — only invoked AFTER an uncached existence check, so this
// function never returns null in practice and a transient null can never
// be baked into the cache. TTL is `seconds` for admin freshness;
// mutations call updateTag('platform-family:<id>') for instant revalidation.
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
  const db = await getCentralDb();
  if (!(await familyExists(db, id))) {
    return { title: 'Family tree not found' };
  }
  const data = await getCachedFamilyDetail(id);
  return { title: data ? `${data.family.name} — Admin` : 'Family tree not found' };
}

export default async function AdminFamilyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getCentralDb();
  if (!(await familyExists(db, id))) notFound();
  const data = await getCachedFamilyDetail(id);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/families">
          <ChevronLeft className="size-4" />
          Back to family trees
        </Link>
      </Button>
      <FamilyDetail data={data} />
    </div>
  );
}
