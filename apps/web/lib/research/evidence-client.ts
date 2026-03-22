'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Generic fetch hook helper
// ---------------------------------------------------------------------------
function useFetchData<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// usePersonFacts — fetch /api/research/facts?personId=...
// ---------------------------------------------------------------------------
export function usePersonFacts(personId: string) {
  const { data, isLoading, error, refetch } = useFetchData<{
    facts: Array<{
      id: string;
      personId: string;
      researchItemId: string | null;
      factType: string;
      factValue: string;
      factDate: string | null;
      factPlace: string | null;
      confidence: string;
      notes: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  }>(personId ? `/api/research/facts?personId=${encodeURIComponent(personId)}` : null);

  return { facts: data?.facts ?? [], isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// usePersonConflicts — fetch /api/research/conflicts?personId=...
// ---------------------------------------------------------------------------
export function usePersonConflicts(personId: string) {
  const { data, isLoading, error, refetch } = useFetchData<{
    conflicts: Array<{
      factType: string;
      facts: Array<{
        id: string;
        factValue: string;
        confidence: string;
        researchItemId: string | null;
      }>;
    }>;
  }>(personId ? `/api/research/conflicts?personId=${encodeURIComponent(personId)}` : null);

  return { conflicts: data?.conflicts ?? [], isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// usePersonResearchItems — fetch /api/research/items?personId=...
// ---------------------------------------------------------------------------
export function usePersonResearchItems(personId: string) {
  const { data, isLoading, error, refetch } = useFetchData<{
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
  }>(personId ? `/api/research/items?personId=${encodeURIComponent(personId)}` : null);

  return { items: data?.items ?? [], isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// extractFacts — POST /api/research/facts/extract
// ---------------------------------------------------------------------------
export async function extractFacts(text: string, personContext?: string) {
  const res = await fetch('/api/research/facts/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, personContext }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Extraction failed' }));
    throw new Error(err.error ?? 'Extraction failed');
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// promoteToCitation — PATCH /api/research/items/:id → status: 'promoted'
// ---------------------------------------------------------------------------
export async function promoteToCitation(researchItemId: string, _personId: string) {
  const res = await fetch(`/api/research/items/${encodeURIComponent(researchItemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'promoted' }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Promotion failed' }));
    throw new Error(err.error ?? 'Promotion failed');
  }

  return res.json();
}
