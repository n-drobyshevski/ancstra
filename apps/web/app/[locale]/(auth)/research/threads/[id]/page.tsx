import { Suspense } from 'react';
import { requirePagePermission } from '@/lib/auth/page-guard';
import { PagePadding } from '@/components/page-padding';
import {
  loadThread,
  getCachedThreadPersons,
} from '@/lib/research/thread-loaders';
import { ThreadDetailView } from '@/components/research/threads/thread-detail-view';

async function ThreadDetailDataShell({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePagePermission('ai:research');

  // Kick off both reads in parallel; neither is awaited here so the
  // <Suspense> boundary owns the loading state and the client component
  // resolves them via React 19's `use()` hook.
  const threadPromise = loadThread(ctx.dbFilename, id);
  const personsPromise = getCachedThreadPersons(ctx.dbFilename, id);

  return (
    <PagePadding>
      <ThreadDetailView
        threadId={id}
        threadPromise={threadPromise}
        personsPromise={personsPromise}
      />
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
      <ThreadDetailDataShell params={params} />
    </Suspense>
  );
}
