import { Suspense } from 'react';
import { FactsheetsShell } from '@/components/research/factsheets/factsheets-shell';
import { FactsheetsShellSkeleton } from '@/components/skeletons/factsheets-shell-skeleton';

interface FactsheetsPageProps {
  searchParams: Promise<{ fs?: string; view?: string }>;
}

// Static shell: the page itself does no awaits, so the outer chrome ships
// from prerender. The async FactsheetsShell streams in behind a Suspense
// boundary with a layout-shaped skeleton, mirroring the dashboard pattern.
export default function FactsheetsPage({ searchParams }: FactsheetsPageProps) {
  return (
    <div className="h-full p-3 sm:p-4 md:p-6">
      <Suspense fallback={<FactsheetsShellSkeleton />}>
        <FactsheetsShell searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
