import { cacheLife, cacheTag } from 'next/cache';
import { getCentralDb } from '@/lib/db-singleton';
import { listAllUsers } from '@ancstra/auth/admin';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { UsersTable } from '@/components/admin/users-table';
import { DataTableToolbar } from '@/components/admin/data-table-toolbar';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { AddUserDialog } from '@/components/admin/add-user-dialog';

export const metadata = { title: 'Users — Admin' };

const PAGE_SIZE = 50;

// Cache key derives from (q, offset). Normalize q to '' at call site so
// undefined and empty don't produce different cache entries.
async function getCachedUsersPage(q: string, offset: number) {
  'use cache';
  cacheLife('minutes');
  cacheTag('platform-users');
  const db = await getCentralDb();
  return listAllUsers(db, { q: q || undefined, offset, limit: PAGE_SIZE });
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const offset = Math.max(0, parseInt(sp.offset ?? '0', 10) || 0);

  const viewer = await requirePlatformAdmin();
  const { rows, total } = await getCachedUsersPage(q, offset);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Every account in the central registry.
          </p>
        </div>
        <AddUserDialog />
      </div>
      <DataTableToolbar
        basePath="/admin/users"
        q={q}
        total={total}
        placeholder="Search by name or email…"
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
