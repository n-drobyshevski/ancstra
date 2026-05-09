import { Suspense } from 'react';
import { FactsheetsShell } from '@/components/research/factsheets/factsheets-shell';
import { FactsheetsShellSkeleton } from '@/components/skeletons/factsheets-shell-skeleton';
import { requirePagePermission } from '@/lib/auth/page-guard';

interface FactsheetsPageProps {
  searchParams: Promise<{ fs?: string; view?: string }>;
}

// Outer chrome ships from prerender; the page guard + data shell stream in
// behind a Suspense boundary with a layout-shaped skeleton. The guard runs
// before the shell renders, so unauthorised users still hit the redirect —
// they just see the skeleton briefly first.
async function GuardedFactsheetsShell({ searchParams }: FactsheetsPageProps) {
  await requirePagePermission('ai:research');
  return <FactsheetsShell searchParams={searchParams} />;
}

export default function FactsheetsPage({ searchParams }: FactsheetsPageProps) {
  return (
    <div className="h-full p-3 sm:p-4 md:p-6">
      <Suspense fallback={<FactsheetsShellSkeleton />}>
        <GuardedFactsheetsShell searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
