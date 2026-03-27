import { Suspense } from 'react';
import { FactsheetsLayout } from '@/components/research/factsheets/factsheets-layout';

export default function FactsheetsPage() {
  return (
    <div className="p-4">
      <Suspense fallback={<div className="flex h-96 items-center justify-center text-muted-foreground">Loading factsheets...</div>}>
        <FactsheetsLayout />
      </Suspense>
    </div>
  );
}
