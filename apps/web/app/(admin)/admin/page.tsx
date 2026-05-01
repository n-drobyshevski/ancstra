import { getCentralDb } from '@/lib/db-singleton';
import { getPlatformCounts } from '@ancstra/auth/admin';
import { DashboardCards } from '@/components/admin/dashboard-cards';

export default async function AdminDashboardPage() {
  const db = await getCentralDb();
  const counts = await getPlatformCounts(db);

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
