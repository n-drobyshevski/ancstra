import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cacheLife, cacheTag } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { getCentralDb } from '@/lib/db-singleton';
import { listAllFamilies } from '@ancstra/auth/admin';
import { FamiliesTable } from '@/components/admin/families-table';
import { DataTableToolbar } from '@/components/admin/data-table-toolbar';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { AddFamilyDialog } from '@/components/admin/add-family-dialog';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.families.page');
  return { title: `${t('heading')} — Admin` };
}

const PAGE_SIZE = 50;

async function getCachedFamiliesPage(q: string, offset: number) {
  'use cache';
  cacheLife('minutes');
  cacheTag('platform-families');
  const db = await getCentralDb();
  return listAllFamilies(db, { q: q || undefined, offset, limit: PAGE_SIZE });
}

interface AdminFamiliesPageProps {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

async function AdminFamiliesContent({ searchParams }: AdminFamiliesPageProps) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const offset = Math.max(0, parseInt(sp.offset ?? '0', 10) || 0);

  const [t, { rows, total }] = await Promise.all([
    getTranslations('admin.families.page'),
    getCachedFamiliesPage(q, offset),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('heading')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('tagline')}
          </p>
        </div>
        <AddFamilyDialog />
      </div>
      <DataTableToolbar
        basePath="/admin/families"
        q={q}
        total={total}
        placeholder={t('searchPlaceholder')}
      />
      <FamiliesTable rows={rows} />
      <DataTablePagination
        basePath="/admin/families"
        q={q || undefined}
        offset={offset}
        limit={PAGE_SIZE}
        total={total}
      />
    </div>
  );
}

export default function AdminFamiliesPage({ searchParams }: AdminFamiliesPageProps) {
  return (
    <Suspense fallback={null}>
      <AdminFamiliesContent searchParams={searchParams} />
    </Suspense>
  );
}
