import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cacheLife, cacheTag } from 'next/cache';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCentralDb } from '@/lib/db-singleton';
import { listAllUsers } from '@ancstra/auth/admin';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { UsersTable } from '@/components/admin/users-table';
import { DataTableToolbar } from '@/components/admin/data-table-toolbar';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { AddUserDialog } from '@/components/admin/add-user-dialog';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.users.page' });
  return { title: `${t('heading')} — Admin` };
}

const PAGE_SIZE = 50;

async function getCachedUsersPage(q: string, offset: number) {
  'use cache';
  cacheLife('minutes');
  cacheTag('platform-users');
  const db = await getCentralDb();
  return listAllUsers(db, { q: q || undefined, offset, limit: PAGE_SIZE });
}

interface AdminUsersPageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string; offset?: string }>;
}

async function AdminUsersContent({ params, searchParams }: AdminUsersPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const offset = Math.max(0, parseInt(sp.offset ?? '0', 10) || 0);

  const viewer = await requirePlatformAdmin();
  const [t, { rows, total }] = await Promise.all([
    getTranslations('admin.users.page'),
    getCachedUsersPage(q, offset),
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
        <AddUserDialog />
      </div>
      <DataTableToolbar
        basePath="/admin/users"
        q={q}
        total={total}
        placeholder={t('searchPlaceholder')}
      />
      <UsersTable rows={rows} currentUserId={viewer.userId} />
      <DataTablePagination
        basePath="/admin/users"
        q={q || undefined}
        offset={offset}
        limit={PAGE_SIZE}
        total={total}
      />
    </div>
  );
}

export default function AdminUsersPage({ params, searchParams }: AdminUsersPageProps) {
  return (
    <Suspense fallback={null}>
      <AdminUsersContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
