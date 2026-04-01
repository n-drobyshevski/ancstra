import { Suspense } from 'react';
import { FactsheetsLayout } from '@/components/research/factsheets/factsheets-layout';
import { PagePadding } from '@/components/page-padding';

export default function FactsheetsPage() {
  return (
    <PagePadding>
    <div className="h-full">
      <Suspense fallback={<div className="flex h-96 items-center justify-center text-muted-foreground">Loading factsheets...</div>}>
        <FactsheetsLayout />
      </Suspense>
    </div>
    </PagePadding>
  );
}
