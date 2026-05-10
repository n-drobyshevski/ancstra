'use client';

import { useCallback, useEffect, useState } from 'react';
import { useIsHydrated } from '@/hooks/use-is-hydrated';

export interface ActiveThread {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'resolved' | 'abandoned';
  summary: string | null;
  eventCount?: number;
  updatedAt: string;
}

/**
 * Read + update the currently-active research thread for the current family.
 * Persists across reloads via an httpOnly cookie keyed by family_id.
 */
export function useActiveThread() {
  const isHydrated = useIsHydrated();
  const [thread, setThread] = useState<ActiveThread | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isHydrated) return;
    let cancelled = false;
    fetch('/api/research/threads/active')
      .then(r => r.json())
      .then(data => { if (!cancelled) setThread(data.thread ?? null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isHydrated]);

  const setActive = useCallback(async (threadId: string | null) => {
    const res = await fetch('/api/research/threads/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
    });
    if (!res.ok) throw new Error(`Failed to set active thread: ${res.status}`);
    if (threadId) {
      const fresh = await fetch(`/api/research/threads/${threadId}`).then(r => r.json());
      setThread(fresh);
    } else {
      setThread(null);
    }
  }, []);

  return { thread, loading, setActive };
}
