'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { Loader2, Search, TriangleAlert, X } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface UserOption {
  id: string;
  name: string;
  email: string;
  ownedFamiliesCount: number;
}

export interface UserPickerFieldProps {
  value: UserOption | null;
  onChange: (user: UserOption | null) => void;
  /** Disable input/buttons while a parent mutation is pending. */
  disabled?: boolean;
  /** Exclude one user from results server-side. */
  excludeUserId?: string;
  /** Exclude additional users client-side. */
  excludeUserIds?: ReadonlyArray<string>;
  /** Visible label rendered above the search input. Empty string hides it. */
  label?: string;
  /** Search debounce in ms. Default 200. */
  debounceMs?: number;
  /** Page size of search results. Default 8. */
  limit?: number;
  /** How long results stay fresh in the react-query cache. Default 30s. */
  staleMs?: number;
}

/**
 * Search-and-select a user. Symmetric mirror of FamilyPickerField for the
 * "pick an owner when provisioning a new family" flow on /admin/families.
 *
 * Behavioral parity with FamilyPickerField:
 * - Always-on query with enabled: !value, primed before dialog opens
 * - placeholderData: keepPreviousData for in-place result swaps
 * - Client-side narrow on the cached set using the immediate (non-debounced)
 *   query for instant-feel; server-side query confirms with the authoritative
 *   filtered set on debounce.
 *
 * Differences:
 * - No cap-warning UI (no per-user ownership cap exists)
 * - Each row shows: name (top), `email · owns N families` (subtext)
 */
export function UserPickerField({
  value,
  onChange,
  disabled = false,
  excludeUserId,
  excludeUserIds,
  label = 'Owner',
  debounceMs = 200,
  limit = 8,
  staleMs = 30_000,
}: UserPickerFieldProps) {
  const reactId = useId();
  const inputId = `user-picker-${reactId}`;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  const search = trpc.platformAdmin.searchUsers.useQuery(
    {
      q: debouncedQuery,
      excludeUserId,
      limit,
    },
    {
      enabled: !value,
      staleTime: staleMs,
      placeholderData: keepPreviousData,
    },
  );

  const data = search.data ?? [];
  const lowerQuery = query.trim().toLowerCase();

  const excludeSet = useMemo(
    () =>
      excludeUserIds && excludeUserIds.length > 0
        ? new Set(excludeUserIds)
        : null,
    [excludeUserIds],
  );

  // Client-side narrow on the cached set using the IMMEDIATE query string.
  // Filters on BOTH name and email so the in-flight view matches the server
  // scope (searchUsers' LIKE clause filters name OR email) — that way the
  // post-debounce server response just confirms what the user already sees,
  // never widens or contradicts it. excludeUserIds (plural) is also applied
  // here so callers can exclude multiple users — the server-side
  // excludeUserId only takes one.
  const visible = useMemo(() => {
    let result: ReadonlyArray<UserOption> = data;
    if (excludeSet) {
      result = result.filter((u) => !excludeSet.has(u.id));
    }
    if (lowerQuery) {
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(lowerQuery) ||
          u.email.toLowerCase().includes(lowerQuery),
      );
    }
    return result;
  }, [data, lowerQuery, excludeSet]);

  // No useIsHydrated gate (which family-picker-field uses): isFetching is
  // only consumed for conditional element rendering (the in-input spinner
  // and the "Searching…" branch in SearchResults), never as a DOM attribute
  // value, so it can't cause a hydration-mismatch warning.
  const isFetching = search.isFetching;
  const isCold = search.isPending;
  const isRefetchingInBg = isFetching && !isCold;

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-primary/50 bg-primary/5 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {value.email} · owns{' '}
              <span className="tabular-nums">{value.ownedFamiliesCount}</span>{' '}
              {value.ownedFamiliesCount === 1 ? 'family' : 'families'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              onChange(null);
              setQuery('');
            }}
            disabled={disabled}
            aria-label="Choose a different user"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={inputId}
              autoComplete="off"
              placeholder="Search by name or email…"
              className="pl-9 pr-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={disabled}
            />
            {isRefetchingInBg ? (
              <Loader2
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              />
            ) : null}
          </div>
          <SearchResults
            query={query.trim()}
            isCold={isCold}
            isFetching={isFetching}
            data={visible}
            onPick={onChange}
          />
        </>
      )}
    </div>
  );
}

interface SearchResultsProps {
  query: string;
  isCold: boolean;
  isFetching: boolean;
  data: ReadonlyArray<UserOption>;
  onPick: (u: UserOption) => void;
}

function SearchResults({
  query,
  isCold,
  isFetching,
  data,
  onPick,
}: SearchResultsProps) {
  if (isCold) {
    return (
      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Loading users…
      </div>
    );
  }

  if (data.length === 0) {
    if (isFetching) {
      return (
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Searching…
        </div>
      );
    }
    if (query.length === 0) {
      return (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          <TriangleAlert className="size-3.5" />
          No users yet.
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        <TriangleAlert className="size-3.5" />
        No users match &quot;{query}&quot;.
      </div>
    );
  }

  return (
    <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
      {data.map((u) => (
        <li key={u.id}>
          <button
            type="button"
            onClick={() => onPick(u)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {u.email} · owns{' '}
                <span className="tabular-nums">{u.ownedFamiliesCount}</span>{' '}
                {u.ownedFamiliesCount === 1 ? 'family' : 'families'}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
