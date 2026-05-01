import { cacheLife, cacheTag } from 'next/cache';
import { getCentralDb } from '@/lib/db-singleton';
import { getPlatformCounts } from '@ancstra/auth/admin';
import { DashboardCards } from '@/components/admin/dashboard-cards';

// Cache the 5 aggregate COUNT queries against Turso. With cacheLife('minutes')
// the dashboard becomes near-instant on every hit after the first per minute.
// Invalidated by `revalidateTag('platform-counts')` from togglePlatformAdmin.
async function getCachedPlatformCounts() {
  'use cache';
  cacheLife('minutes');
  cacheTag('platform-counts');
  const db = await getCentralDb();
  return getPlatformCounts(db, new Date());
}

export default async function AdminDashboardPage() {
  const counts = await getCachedPlatformCounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Cross-family snapshot of the Ancstra platform.
        </p>
      </div>
      <DashboardCards counts={counts} />
    </div>
  );
}
