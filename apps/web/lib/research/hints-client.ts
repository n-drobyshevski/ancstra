'use client';

import { useState, useEffect, useCallback } from 'react';

interface MatchCandidateRow {
  id: string;
  personId: string;
  sourceSystem: string;
  externalId: string;
  externalData: string;
  matchScore: number;
  matchStatus: 'pending' | 'accepted' | 'rejected' | 'maybe';
  reviewedAt: string | null;
  createdAt: string;
}

interface HintsResponse {
  hints: MatchCandidateRow[];
  count: number;
}

/**
 * Fetch hints for a person, optionally filtered by status.
 */
export function usePersonHints(personId: string, status?: string) {
  const [hints, setHints] = useState<MatchCandidateRow[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHints = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ personId });
      if (status) params.set('status', status);
      const res = await fetch(`/api/matching/hints?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch hints (${res.status})`);
      const json: HintsResponse = await res.json();
      setHints(json.hints);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch hints'));
    } finally {
      setIsLoading(false);
    }
  }, [personId, status]);

  useEffect(() => {
    fetchHints();
  }, [fetchHints]);

  return { hints, isLoading, error, refetch: fetchHints };
}

/**
 * Trigger hint generation for a person.
 */
export async function generateHints(personId: string): Promise<{
  generated: number;
  newHints: number;
  totalSearchResults: number;
}> {
  const res = await fetch('/api/matching/hints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Hint generation failed (${res.status})`);
  }
  return res.json();
}

/**
 * Update a hint's status (accept/reject/maybe).
 */
export async function updateHintStatus(
  hintId: string,
  matchStatus: 'accepted' | 'rejected' | 'maybe',
): Promise<MatchCandidateRow> {
  const res = await fetch(`/api/matching/hints/${hintId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchStatus }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Status update failed (${res.status})`);
  }
  return res.json();
}
