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
// Types
// ---------------------------------------------------------------------------

export interface Factsheet {
  id: string;
  title: string;
  entityType: 'person' | 'couple' | 'family_unit';
  status: 'draft' | 'ready' | 'promoted' | 'merged' | 'dismissed';
  notes: string | null;
  promotedPersonId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FactsheetFact {
  id: string;
  personId: string;
  factType: string;
  factValue: string;
  factDateSort: number | null;
  researchItemId: string | null;
  sourceCitationId: string | null;
  factsheetId: string | null;
  accepted: boolean | null;
  confidence: string;
  extractionMethod: string;
  createdAt: string;
  updatedAt: string;
}

export interface FactsheetLink {
  id: string;
  fromFactsheetId: string;
  toFactsheetId: string;
  relationshipType: 'parent_child' | 'spouse' | 'sibling';
  sourceFactId: string | null;
  confidence: string;
  createdAt: string;
}

export interface FactsheetDetail extends Factsheet {
  facts: FactsheetFact[];
  links: FactsheetLink[];
}

export interface DuplicateMatch {
  personId: string;
  givenName: string;
  surname: string;
  score: number;
  matchedFields: string[];
}

export interface FactsheetConflict {
  factType: string;
  facts: Array<{
    id: string;
    factValue: string;
    confidence: string;
    accepted: boolean | null;
    researchItemId: string | null;
  }>;
}

export interface InboxItem {
  id: string;
  title: string;
  url: string | null;
  snippet: string | null;
  status: string;
  discoveryMethod: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// useFactsheets — fetch /api/research/factsheets?personId=...
// ---------------------------------------------------------------------------
export function useFactsheets(personId: string) {
  const { data, isLoading, error, refetch } = useFetchData<{
    factsheets: Factsheet[];
  }>(`/api/research/factsheets?personId=${personId}`);

  return { factsheets: data?.factsheets ?? [], isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// useFactsheetDetail — fetch /api/research/factsheets/:id
// ---------------------------------------------------------------------------
export function useFactsheetDetail(factsheetId: string | null) {
  const { data, isLoading, error, refetch } = useFetchData<FactsheetDetail>(
    factsheetId ? `/api/research/factsheets/${factsheetId}` : null
  );

  return { detail: data, isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// useFactsheetConflicts — fetch /api/research/factsheets/:id/conflicts
// ---------------------------------------------------------------------------
export function useFactsheetConflicts(factsheetId: string | null) {
  const { data, isLoading, error, refetch } = useFetchData<{
    conflicts: FactsheetConflict[];
  }>(factsheetId ? `/api/research/factsheets/${factsheetId}/conflicts` : null);

  return { conflicts: data?.conflicts ?? [], isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// useFactsheetDuplicates — fetch /api/research/factsheets/:id/duplicates
// ---------------------------------------------------------------------------
export function useFactsheetDuplicates(factsheetId: string | null, enabled: boolean) {
  const { data, isLoading, error, refetch } = useFetchData<{
    matches: DuplicateMatch[];
  }>(
    factsheetId && enabled
      ? `/api/research/factsheets/${factsheetId}/duplicates`
      : null
  );

  return { matches: data?.matches ?? [], isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// useAllFactsheets — fetch /api/research/factsheets?include=counts (all persons)
// ---------------------------------------------------------------------------

export interface FactsheetWithCounts extends Factsheet {
  factCount: number;
  linkCount: number;
  conflictCount: number;
  isUnanchored: boolean;
}

export function useAllFactsheets() {
  const { data, isLoading, error, refetch } = useFetchData<{
    factsheets: FactsheetWithCounts[];
  }>('/api/research/factsheets?include=counts');
  return { factsheets: data?.factsheets ?? [], isLoading, error, refetch };
}

export function useFactsheetCount() {
  const { factsheets } = useAllFactsheets();
  const count = factsheets.filter(
    (fs) => fs.status === 'draft' || fs.status === 'ready'
  ).length;
  return { count };
}

// ---------------------------------------------------------------------------
// useInbox — fetch /api/research/inbox
// ---------------------------------------------------------------------------
export function useInbox() {
  const { data, isLoading, error, refetch } = useFetchData<{
    items: InboxItem[];
    total: number;
  }>('/api/research/inbox');

  return { items: data?.items ?? [], total: data?.total ?? 0, isLoading, error, refetch };
}

// ---------------------------------------------------------------------------
// useInboxCount — fetch /api/research/inbox?count=true
// ---------------------------------------------------------------------------
export function useInboxCount() {
  const { data, isLoading, refetch } = useFetchData<{
    count: number;
  }>('/api/research/inbox?count=true');

  return { count: data?.count ?? 0, isLoading, refetch };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createFactsheet(
  title: string,
  entityType: 'person' | 'couple' | 'family_unit' = 'person'
): Promise<Factsheet> {
  const res = await fetch('/api/research/factsheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, entityType }),
  });
  return res.json();
}

export async function updateFactsheet(
  id: string,
  data: { title?: string; notes?: string; status?: string }
) {
  const res = await fetch(`/api/research/factsheets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteFactsheet(id: string) {
  await fetch(`/api/research/factsheets/${id}`, { method: 'DELETE' });
}

export async function assignFactToFactsheet(factsheetId: string, factId: string) {
  const res = await fetch(`/api/research/factsheets/${factsheetId}/facts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ factId }),
  });
  return res.json();
}

export async function removeFactFromFactsheet(factsheetId: string, factId: string) {
  await fetch(`/api/research/factsheets/${factsheetId}/facts`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ factId }),
  });
}

export async function createFactsheetLink(
  fromId: string,
  toId: string,
  relationshipType: string,
  sourceFactId?: string
) {
  const res = await fetch(`/api/research/factsheets/${fromId}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toFactsheetId: toId, relationshipType, sourceFactId }),
  });
  return res.json();
}

export async function resolveFactsheetConflict(
  factsheetId: string,
  acceptedFactId: string,
  rejectedFactIds: string[]
) {
  const res = await fetch(`/api/research/factsheets/${factsheetId}/conflicts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acceptedFactId, rejectedFactIds }),
  });
  return res.json();
}

export async function promoteFactsheet(
  factsheetId: string,
  mode: 'create' | 'merge',
  mergeTargetPersonId?: string,
  cluster?: boolean
) {
  const res = await fetch(`/api/research/factsheets/${factsheetId}/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, mergeTargetPersonId, cluster }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Promotion failed' }));
    throw new Error(err.error ?? 'Promotion failed');
  }

  return res.json();
}

export async function fetchLinkSuggestions(factsheetId: string) {
  const res = await fetch(
    `/api/research/factsheets/${factsheetId}/links?suggest=true`
  );
  return res.json();
}
