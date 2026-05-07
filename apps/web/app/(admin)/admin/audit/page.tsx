import { AuditLogTable } from '@/components/admin/audit-log-table';

export const metadata = { title: 'Audit Log — Admin' };

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Platform-admin actions and cross-family overrides. Read-only.
        </p>
      </div>
      <AuditLogTable />
    </div>
  );
}
