'use client';

import { useCallback, useEffect, useState } from 'react';
import { useIsHydrated } from './use-is-hydrated';

export interface SearchAttempt {
  id: string;
  personId: string;
  threadId: string | null;
  researchItemId: string | null;
  providerKind: string;
  providerLabel: string | null;
  query: string | null;
  searchedAt: number;
  outcome: string;
  notes: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

interface UseSearchAttemptsResult {
  items: SearchAttempt[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Bundle E 2026-05-26 — fetches a person's search attempts.
 * Direct-fetch over GET /api/persons/[id]/search-attempts. The mutation hook
 * (use-search-attempt-mutations) calls refetch() on success.
 */
export function useSearchAttempts(personId: string): UseSearchAttemptsResult {
  const isHydrated = useIsHydrated();
  const [items, setItems] = useState<SearchAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/persons/${personId}/search-attempts?limit=100`);
      if (!res.ok) {
        throw new Error(`Failed to load search attempts: ${res.status}`);
      }
      const body = await res.json() as { items: SearchAttempt[] };
      setItems(body.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    if (!isHydrated) return;
    void refetch();
  }, [isHydrated, refetch]);

  return { items, isLoading, error, refetch };
}
