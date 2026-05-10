import { Suspense } from 'react';
import { requirePagePermission } from '@/lib/auth/page-guard';
import { PagePadding } from '@/components/page-padding';
import { ThreadDetailClient } from '@/components/research/threads/thread-detail-client';

async function ThreadDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission('ai:research');
  return (
    <PagePadding>
      <ThreadDetailClient threadId={id} />
    </PagePadding>
  );
}

export default function ThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <ThreadDetailContent params={params} />
    </Suspense>
  );
}
