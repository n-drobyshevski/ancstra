import { Suspense } from 'react';
import { FactsheetsShell } from '@/components/research/factsheets/factsheets-shell';
import { FactsheetsShellSkeleton } from '@/components/skeletons/factsheets-shell-skeleton';
import { requirePagePermission } from '@/lib/auth/page-guard';

interface FactsheetsPageProps {
  searchParams: Promise<{ fs?: string; view?: string }>;
}

// Outer chrome ships from prerender; the async FactsheetsShell streams in
// behind a Suspense boundary with a layout-shaped skeleton. The page guard
// is awaited at top-level so unauthorized users redirect before any data
// fetch begins inside the shell.
export default async function FactsheetsPage({ searchParams }: FactsheetsPageProps) {
  await requirePagePermission('ai:research');
  return (
    <div className="h-full p-3 sm:p-4 md:p-6">
      <Suspense fallback={<FactsheetsShellSkeleton />}>
        <FactsheetsShell searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
