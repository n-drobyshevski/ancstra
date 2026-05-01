import { headers } from 'next/headers';
import { getCentralDb } from '@/lib/db-singleton';
import { getPlatformCounts } from '@ancstra/auth/admin';
import { DashboardCards } from '@/components/admin/dashboard-cards';

export default async function AdminDashboardPage() {
  // Touch request data so Next.js 16 marks this render as dynamic — the
  // dashboard reads "now" for the signups-last-7d window. Without this, the
  // cacheComponents analyzer rejects `new Date()` as ambient time access.
  await headers();
  const db = await getCentralDb();
  const counts = await getPlatformCounts(db, new Date());

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
