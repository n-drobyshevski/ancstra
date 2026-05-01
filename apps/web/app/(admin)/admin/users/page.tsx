import { getCentralDb } from '@/lib/db-singleton';
import { listAllUsers } from '@ancstra/auth/admin';
import { UsersTable } from '@/components/admin/users-table';
import { DataTableToolbar } from '@/components/admin/data-table-toolbar';
import { DataTablePagination } from '@/components/admin/data-table-pagination';

export const metadata = { title: 'Users — Admin' };

const PAGE_SIZE = 50;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const offset = Math.max(0, parseInt(sp.offset ?? '0', 10) || 0);

  const db = await getCentralDb();
  const { rows, total } = await listAllUsers(db, { q, offset, limit: PAGE_SIZE });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Every account in the central registry.
        </p>
      </div>
      <DataTableToolbar
        basePath="/admin/users"
        q={q ?? ''}
        total={total}
        placeholder="Search by name or email…"
      />
      <UsersTable rows={rows} />
      <DataTablePagination
        basePath="/admin/users"
        q={q}
        offset={offset}
        limit={PAGE_SIZE}
        total={total}
      />
    </div>
  );
}
