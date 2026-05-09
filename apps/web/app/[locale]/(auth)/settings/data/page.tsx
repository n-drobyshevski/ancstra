import { Suspense } from 'react';
import { requirePagePermission } from '@/lib/auth/page-guard';
import { DataContent } from './data-content';

async function DataGuarded() {
  // Backups, cache, and destructive cleanups are sensitive — gate at gedcom:export
  // (editor+) so admins/editors can manage data, viewers redirect away.
  // Destructive actions inside the content require additional perms (e.g. tree:delete).
  await requirePagePermission('gedcom:export');
  return <DataContent />;
}

export default function DataPage() {
  return (
    <Suspense fallback={null}>
      <DataGuarded />
    </Suspense>
  );
}
