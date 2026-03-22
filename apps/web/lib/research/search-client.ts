'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SearchResult } from '@ancstra/research';

interface SearchResponse {
  results: SearchResult[];
  count: number;
}

interface ResearchItemsResponse {
  items: Array<{
    id: string;
    title: string;
    snippet: string | null;
    url: string | null;
    status: string;
    providerId: string | null;
    notes: string | null;
    createdAt: string;
    personIds: string[];
  }>;
}

export function useResearchSearch(query: string, enabled = true, providers?: string) {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !query) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({ q: query });
    if (providers) params.set('providers', providers);

    fetch(`/api/research/search?${params}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        return res.json();
      })
      .then((json: SearchResponse) => {
        setData(json);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err : new Error('Search failed'));
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [query, enabled, providers]);

  return { data, error, isLoading };
}

export function useResearchItems(status?: string) {
  const [data, setData] = useState<ResearchItemsResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = status ? `?status=${status}` : '';
      const res = await fetch(`/api/research/items${params}`);
      if (!res.ok) throw new Error(`Failed to load items (${res.status})`);
      const json: ResearchItemsResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load items'));
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { data, error, isLoading, refetch: fetchItems };
}
