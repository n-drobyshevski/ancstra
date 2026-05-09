import { Suspense } from 'react';
import { requirePagePermission } from '@/lib/auth/page-guard';
import { SearchSourcesContent } from './sources-content';

async function SearchSourcesGuarded() {
  // Search-source configuration affects research workflows that admins lead
  // day-to-day; gated at members:manage so admins can toggle providers without
  // owner intervention. Editors / viewers and lensed-down users still redirect.
  await requirePagePermission('members:manage');
  return <SearchSourcesContent />;
}

export default function SearchSourcesPage() {
  return (
    <Suspense fallback={null}>
      <SearchSourcesGuarded />
    </Suspense>
  );
}
