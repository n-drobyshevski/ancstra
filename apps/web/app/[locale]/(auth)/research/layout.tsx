import type { ReactNode } from 'react';
import { requireAuthContext } from '@/lib/auth/context';
import { hasPermission } from '@ancstra/auth';
import { getCachedActiveThreads } from '@/lib/research/thread-loaders';
import { ActiveThreadsClientProvider } from '@/components/research/threads/active-threads-context';
import { ThreadHeaderBar } from '@/components/research/threads/thread-header-bar';
import type { ThreadListItem } from '@/lib/research/use-thread-list';

/**
 * Resolves the active-threads promise once per request and threads it
 * down to the quick-switcher + any other research consumers via React
 * context. The promise itself isn't awaited here — consumers do
 * `use(promise)` inside their own Suspense boundaries, so the layout
 * doesn't block on cache lookups.
 */
export default async function ResearchLayout({ children }: { children: ReactNode }) {
  const ctx = await requireAuthContext();
  const promise: Promise<ThreadListItem[]> = hasPermission(ctx.role, 'ai:research')
    ? getCachedActiveThreads(ctx.dbFilename)
    : Promise.resolve([] as ThreadListItem[]);

  return (
    <ActiveThreadsClientProvider promise={promise}>
      <ThreadHeaderBar />
      {children}
    </ActiveThreadsClientProvider>
  );
}
