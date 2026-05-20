import { Suspense } from 'react';
import { requirePagePermission } from '@/lib/auth/page-guard';
import { getCachedThreadList } from '@/lib/research/thread-loaders';
import { ThreadListShell } from '@/components/research/threads/thread-list-shell';
import { ThreadListSkeleton } from '@/components/skeletons/thread-list-skeleton';
import { THREAD_STATUS_FILTER, type ThreadStatusFilter } from '@/lib/research/threads-search-params';
import type { ThreadStatus } from '@ancstra/research';

interface SearchParams {
  q?: string;
  status?: string;
}

// Async data shell: resolves auth + searchParams, then hands a cached
// thread-list promise to the client shell. Wrapped in <Suspense> so the
// skeleton paints instantly during initial load and during cross-URL
// navigation when the search/status filter changes.
async function ThreadListDataShell({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePagePermission('ai:research');
  const params = await searchParams;
  const q = (params.q ?? '').trim();

  // Validate status query param against our known filter set so the loader
  // gets a typed ThreadStatus | undefined (not an arbitrary string).
  const raw = (params.status ?? 'all') as ThreadStatusFilter;
  const validStatus: ThreadStatus | undefined =
    THREAD_STATUS_FILTER.includes(raw) && raw !== 'all' ? raw : undefined;

  const threadsPromise = getCachedThreadList(ctx.dbFilename, {
    q: q.length > 0 ? q : undefined,
    status: validStatus,
  });

  return <ThreadListShell threadsPromise={threadsPromise} />;
}

export default function ThreadListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <div className="h-full p-3 sm:p-4 md:p-6">
      <Suspense fallback={<ThreadListSkeleton />}>
        <ThreadListDataShell searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
