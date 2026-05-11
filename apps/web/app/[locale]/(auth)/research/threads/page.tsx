import { Suspense } from 'react';
import { requirePagePermission } from '@/lib/auth/page-guard';
import { ThreadListShell } from '@/components/research/threads/thread-list-shell';
import { ThreadListSkeleton } from '@/components/skeletons/thread-list-skeleton';

// Outer chrome ships from prerender; the page guard runs behind a
// Suspense boundary with a layout-shaped skeleton (matches
// /research/factsheets convention). Unauthorised users still hit the
// redirect — they just see the skeleton briefly first.
async function GuardedThreadList() {
  await requirePagePermission('ai:research');
  return <ThreadListShell />;
}

export default function ThreadListPage() {
  return (
    <div className="h-full p-3 sm:p-4 md:p-6">
      <Suspense fallback={<ThreadListSkeleton />}>
        <GuardedThreadList />
      </Suspense>
    </div>
  );
}
