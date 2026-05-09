import { Suspense } from 'react';
import { ResearchLayout } from '@/components/research/research-layout';
import { PagePadding } from '@/components/page-padding';
import { requirePagePermission } from '@/lib/auth/page-guard';

async function ResearchContent() {
  await requirePagePermission('ai:research');
  return <PagePadding><ResearchLayout /></PagePadding>;
}

export default function ResearchPage() {
  return (
    <Suspense fallback={null}>
      <ResearchContent />
    </Suspense>
  );
}
