import { cacheLife, cacheTag } from 'next/cache';
import { getCentralDb } from '@/lib/db-singleton';
import { listAllFamilies } from '@ancstra/auth/admin';
import { FamiliesTable } from '@/components/admin/families-table';
import { DataTableToolbar } from '@/components/admin/data-table-toolbar';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { AddFamilyDialog } from '@/components/admin/add-family-dialog';

export const metadata = { title: 'Family trees — Admin' };

const PAGE_SIZE = 50;

async function getCachedFamiliesPage(q: string, offset: number) {
  'use cache';
  cacheLife('minutes');
  cacheTag('platform-families');
  const db = await getCentralDb();
  return listAllFamilies(db, { q: q || undefined, offset, limit: PAGE_SIZE });
}

export default async function AdminFamiliesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const offset = Math.max(0, parseInt(sp.offset ?? '0', 10) || 0);

  const { rows, total } = await getCachedFamiliesPage(q, offset);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Family trees</h1>
          <p className="text-sm text-muted-foreground">
            All family trees registered on the platform.
          </p>
        </div>
        <AddFamilyDialog />
      </div>
      <DataTableToolbar
        basePath="/admin/families"
        q={q}
        total={total}
        placeholder="Search by family name…"
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
