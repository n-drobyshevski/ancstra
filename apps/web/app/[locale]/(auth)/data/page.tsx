import { Suspense } from 'react';
import { DataTransferTabs } from '@/components/data-transfer-tabs';
import { PagePadding } from '@/components/page-padding';
import { requirePagePermissionAny } from '@/lib/auth/page-guard';

async function DataContent() {
  // Editors hold gedcom:export but not gedcom:import; admins/owners hold both.
  // Viewers hold neither and get redirected with a toast.
  await requirePagePermissionAny(['gedcom:import', 'gedcom:export']);
  return (
    <PagePadding>
      <div className="max-w-2xl mx-auto py-8">
        <h1 className="text-xl font-semibold mb-6">Import & Export</h1>
        <DataTransferTabs />
      </div>
    </PagePadding>
  );
}

export default function DataPage() {
  return (
    <Suspense fallback={null}>
      <DataContent />
    </Suspense>
  );
}
