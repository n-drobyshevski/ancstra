import { Suspense } from 'react';
import { connection } from 'next/server';
import { cacheLife, cacheTag } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { centralSchema } from '@ancstra/db';
import { getCentralDb } from '@/lib/db-singleton';
import { getPlatformCounts, listAuditLog } from '@ancstra/auth/admin';
import { DashboardCards } from '@/components/admin/dashboard-cards';
import { RecentActivityWidget } from '@/components/admin/recent-activity-widget';
import { ExperimentalPolicyCard } from '@/components/admin/experimental-policy-card';
import type { Locale } from '@/i18n/routing';

interface AdminDashboardPageProps {
  params: Promise<{ locale: Locale }>;
}

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

async function getCachedExperimentalPolicy() {
  'use cache';
  cacheLife('minutes');
  cacheTag('platform-experimental-policy');
  const db = await getCentralDb();
  const policy = await db
    .select({
      experimentalFeaturesAllowUsers: centralSchema.platformSettings.experimentalFeaturesAllowUsers,
      updatedBy: centralSchema.platformSettings.updatedBy,
    })
    .from(centralSchema.platformSettings)
    .where(eq(centralSchema.platformSettings.id, 'global'))
    .get();
  let lastChangedByName: string | null = null;
  if (policy?.updatedBy) {
    const user = await db
      .select({ name: centralSchema.users.name })
      .from(centralSchema.users)
      .where(eq(centralSchema.users.id, policy.updatedBy))
      .get();
    lastChangedByName = user?.name ?? null;
  }
  return {
    allowUsers: policy?.experimentalFeaturesAllowUsers === 1,
    lastChangedByName,
  };
}

async function AdminDashboardContent({ params }: AdminDashboardPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Skip build-time prerender: this page is admin-only and its `'use cache'`
  // aggregations need a real Turso/SQLite connection. CI has no DB at build,
  // so prerender would fail and bake empty data into the cache for first hit.
  // Cached values still populate on first authenticated request and are
  // invalidated by `revalidateTag('platform-counts' | 'platform-audit-log' |
  // 'platform-experimental-policy')`.
  await connection();
  const [counts, recentActivity, policy, t] = await Promise.all([
    getCachedPlatformCounts(),
    getCachedRecentActivity(),
    getCachedExperimentalPolicy(),
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
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('policiesHeading')}
        </h2>
        <ExperimentalPolicyCard
          initialAllowUsers={policy.allowUsers}
          lastChangedByName={policy.lastChangedByName}
        />
      </div>
    </div>
  );
}

export default function AdminDashboardPage({ params }: AdminDashboardPageProps) {
  return (
    <Suspense fallback={null}>
      <AdminDashboardContent params={params} />
    </Suspense>
  );
}
