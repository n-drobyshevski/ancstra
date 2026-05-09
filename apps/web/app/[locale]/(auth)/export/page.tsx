import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth/page-guard';

async function ExportRedirect() {
  await requirePagePermission('gedcom:export');
  return redirect('/data?tab=export');
}

export default function ExportPage() {
  return (
    <Suspense fallback={null}>
      <ExportRedirect />
    </Suspense>
  );
}
