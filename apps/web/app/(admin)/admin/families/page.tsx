import { getCentralDb } from '@/lib/db-singleton';
import { listAllFamilies } from '@ancstra/auth/admin';
import { FamiliesTable } from '@/components/admin/families-table';
import { DataTableToolbar } from '@/components/admin/data-table-toolbar';
import { DataTablePagination } from '@/components/admin/data-table-pagination';

export const metadata = { title: 'Families — Admin' };

const PAGE_SIZE = 50;

export default async function AdminFamiliesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const offset = Math.max(0, parseInt(sp.offset ?? '0', 10) || 0);

  const db = await getCentralDb();
  const { rows, total } = await listAllFamilies(db, { q, offset, limit: PAGE_SIZE });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Families</h1>
        <p className="text-sm text-muted-foreground">
          All family trees registered on the platform.
        </p>
      </div>
      <DataTableToolbar
        basePath="/admin/families"
        q={q ?? ''}
        total={total}
        placeholder="Search by family name…"
      />
      <FamiliesTable rows={rows} />
      <DataTablePagination
        basePath="/admin/families"
        q={q}
        offset={offset}
        limit={PAGE_SIZE}
        total={total}
      />
    </div>
  );
}
