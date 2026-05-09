import { connection } from 'next/server';
import { cacheLife, cacheTag } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { getCentralDb } from '@/lib/db-singleton';
import { getPlatformCounts, listAuditLog } from '@ancstra/auth/admin';
import { DashboardCards } from '@/components/admin/dashboard-cards';
import { RecentActivityWidget } from '@/components/admin/recent-activity-widget';

// Cache the aggregate COUNT queries against Turso. With cacheLife('minutes')
// the dashboard becomes near-instant on every hit after the first per minute.
// Invalidated by `revalidateTag('platform-counts')` from mutations.
async function getCachedPlatformCounts() {
  'use cache';
  cacheLife('minutes');
  cacheTag('platform-counts');
  const db = await getCentralDb();
  return getPlatformCounts(db, new Date());
}

async function getCachedRecentActivity() {
  'use cache';
  cacheLife('minutes');
  cacheTag('platform-audit-log');
  const db = await getCentralDb();
  const result = await listAuditLog(db, { limit: 5 });
  return result.items;
}

export default async function AdminDashboardPage() {
  // Skip build-time prerender: this page is admin-only and its `'use cache'`
  // aggregations need a real Turso/SQLite connection. CI has no DB at build,
  // so prerender would fail and bake empty data into the cache for first hit.
  // Cached values still populate on first authenticated request and are
  // invalidated by `revalidateTag('platform-counts' | 'platform-audit-log')`.
  await connection();
  const [counts, recentActivity, t] = await Promise.all([
    getCachedPlatformCounts(),
    getCachedRecentActivity(),
    getTranslations('admin.page'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('heading')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('tagline')}
        </p>
      </div>
      <DashboardCards counts={counts} />
      <RecentActivityWidget items={recentActivity} />
    </div>
  );
}
