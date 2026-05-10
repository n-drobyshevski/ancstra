'use client';

import { useEffect, useState } from 'react';
import { useIsHydrated } from '@/hooks/use-is-hydrated';

export interface TreeOverlayData {
  /** Set of person ids the active thread has "touched". */
  touchedPersonIds: Set<string>;
  /** Earliest occurredAt per person id (drives the time-scrubber filter). */
  firstSeenAt: Map<string, string>;
}

/**
 * Fetch overlay data for the active thread. When `threadId` is `null`, the
 * hook resolves to `data: null` (no overlay). Two underlying API calls run
 * in parallel:
 *   - GET /api/research/threads/:id/persons    -> touched person ids
 *   - GET /api/research/threads/:id/events     -> earliest event timestamp per person
 */
export function useTreeOverlay(threadId: string | null) {
  const isHydrated = useIsHydrated();
  const [data, setData] = useState<TreeOverlayData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isHydrated || !threadId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/research/threads/${threadId}/persons`).then(r => r.json()),
      fetch(`/api/research/threads/${threadId}/events?limit=1000`).then(r => r.json()),
    ])
      .then(([personsBody, eventsBody]) => {
        if (cancelled) return;
        const touchedPersonIds = new Set<string>(personsBody.personIds ?? []);
        const firstSeenAt = new Map<string, string>();
        for (const e of (eventsBody.events ?? []) as Array<{ personId: string | null; occurredAt: string }>) {
          if (!e.personId) continue;
          const prev = firstSeenAt.get(e.personId);
          if (!prev || e.occurredAt < prev) firstSeenAt.set(e.personId, e.occurredAt);
        }
        setData({ touchedPersonIds, firstSeenAt });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isHydrated, threadId]);

  return { data, loading };
}
