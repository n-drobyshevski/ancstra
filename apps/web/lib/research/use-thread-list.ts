'use client';

import { useCallback, useEffect, useState } from 'react';
import { useIsHydrated } from '@/hooks/use-is-hydrated';

export type ThreadStatus = 'active' | 'paused' | 'resolved' | 'abandoned';

export interface ThreadListItem {
  id: string;
  title: string;
  status: ThreadStatus;
  summary: string | null;
  seedPersonId: string | null;
  seedFactsheetId: string | null;
  seedResearchItemId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface UseThreadListOptions {
  /** Server-side status filter. Omit to load all statuses. */
  status?: ThreadStatus;
  /** Server-side createdBy filter (user id). */
  createdBy?: string;
}

interface UseThreadListResult {
  threads: ThreadListItem[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Shared fetch + state hook for the thread list. Backs the dedicated list
// page, the ThreadHeaderBar quick-switcher, and the tree-sidebar panel so
// all three share one cache shape and one set of types. The endpoint
// already supports `?status=` and `?createdBy=` filters; everything else
// (sort, title-search, selected row) is handled client-side by callers.
export function useThreadList(options: UseThreadListOptions = {}): UseThreadListResult {
  const isHydrated = useIsHydrated();
  const { status, createdBy } = options;
  const [threads, setThreads] = useState<ThreadListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchThreads = useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (createdBy) params.set('createdBy', createdBy);
    const qs = params.toString();
    const url = qs ? `/api/research/threads?${qs}` : '/api/research/threads';

    setLoading(true);
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`Failed to load threads: ${res.status}`);
      const body = await res.json();
      if (!signal?.aborted) {
        setThreads(Array.isArray(body.threads) ? body.threads : []);
        setError(null);
      }
    } catch (err) {
      if (signal?.aborted) return;
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setThreads([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [status, createdBy]);

  useEffect(() => {
    if (!isHydrated) return;
    const controller = new AbortController();
    void fetchThreads(controller.signal);
    return () => controller.abort();
  }, [isHydrated, fetchThreads]);

  const refetch = useCallback(() => fetchThreads(), [fetchThreads]);

  return { threads, loading, error, refetch };
}
