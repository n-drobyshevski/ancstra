'use client';

import { useState, useCallback } from 'react';
import type { SearchAttempt } from './use-search-attempts';

interface CreateInput {
  threadId?: string | null;
  researchItemId?: string | null;
  providerKind: string;
  providerLabel?: string | null;
  query?: string | null;
  searchedAt: Date | string;
  outcome: string;
  notes?: string | null;
}

interface UpdateInput {
  attemptId: string;
  patch: Partial<CreateInput>;
}

interface MutationResult<T> {
  data: T | null;
  error: { code?: string; message: string; fields?: Record<string, string> } | null;
}

async function postJson<T>(url: string, body: unknown): Promise<MutationResult<T>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    return { data: null, error: json.error ?? { message: `HTTP ${res.status}` } };
  }
  return { data: await res.json(), error: null };
}

async function patchJson<T>(url: string, body: unknown): Promise<MutationResult<T>> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    return { data: null, error: json.error ?? { message: `HTTP ${res.status}` } };
  }
  return { data: await res.json(), error: null };
}

async function deleteJson(url: string): Promise<MutationResult<true>> {
  const res = await fetch(url, { method: 'DELETE' });
  if (res.status === 204) return { data: true, error: null };
  const json = await res.json().catch(() => ({}));
  return { data: null, error: json.error ?? { message: `HTTP ${res.status}` } };
}

/**
 * Bundle E 2026-05-26 — mutations for search attempts.
 * Wraps POST /api/persons/[id]/search-attempts,
 *        PATCH /api/search-attempts/[id],
 *        DELETE /api/search-attempts/[id].
 */
export function useSearchAttemptMutations(personId: string) {
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const create = useCallback(async (input: CreateInput) => {
    setIsCreating(true);
    try {
      return await postJson<SearchAttempt>(`/api/persons/${personId}/search-attempts`, input);
    } finally {
      setIsCreating(false);
    }
  }, [personId]);

  const update = useCallback(async (input: UpdateInput) => {
    setIsUpdating(true);
    try {
      return await patchJson<SearchAttempt>(`/api/search-attempts/${input.attemptId}`, input.patch);
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const remove = useCallback(async (attemptId: string) => {
    setIsDeleting(true);
    try {
      return await deleteJson(`/api/search-attempts/${attemptId}`);
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { create, update, remove, isCreating, isUpdating, isDeleting };
}
