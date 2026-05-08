'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { Loader2, Search, TriangleAlert, X } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface FamilyOption {
  id: string;
  name: string;
  ownerEmail: string;
  memberCount: number;
  maxMembers: number;
}

export interface FamilyPickerFieldProps {
  value: FamilyOption | null;
  onChange: (family: FamilyOption | null) => void;
  /** Disable input/buttons while a parent mutation is pending. */
  disabled?: boolean;
  /** Exclude one family from results server-side (e.g. the source family in a move). */
  excludeFamilyId?: string;
  /** Exclude additional families client-side (e.g. families the user is already in). */
  excludeFamilyIds?: ReadonlyArray<string>;
  /** Visible label rendered above the search input. Empty string hides it. */
  label?: string;
  /** Render the cap-exceeded amber alert when value would push the family over its cap. Default true. */
  showCapWarning?: boolean;
  /** Search debounce in ms. Default 200. */
  debounceMs?: number;
  /** Page size of search results. Default 8. */
  limit?: number;
  /** How long results stay fresh in the react-query cache. Default 30s. */
  staleMs?: number;
}

/**
 * Search-and-select a family from the platform-admin family registry, plus an
 * intrinsic cap-warning when picking a family that's already at its member
 * limit. Used by both `MoveOrAddMemberDialog` and `AddUserDialog`.
 *
 * Performance characteristics:
 *
 * - **Dynamic preloading**: the underlying tRPC query fires on mount with
 *   `q: ''` so a default alphabetical list is ready by the time the dialog
 *   open animation finishes. `staleTime` keeps the cache warm so reopening
 *   the dialog within ~30s skips the network entirely.
 * - **Optimistic search**: `placeholderData: keepPreviousData` keeps the
 *   prior result set visible during refetch — no full "Searching…" flash on
 *   every keystroke. A client-side `includes` filter on the cached data
 *   uses the immediate (non-debounced) query so the list narrows on each
 *   keystroke and the server-side refilter just confirms or extends what
 *   the user already sees.
 * - **`useIsHydrated` gate** on `isFetching` matches the project rule about
 *   tRPC query state in `'use client'` components.
 */
export function FamilyPickerField({
  value,
  onChange,
  disabled = false,
  excludeFamilyId,
  excludeFamilyIds,
  label = 'Family',
  showCapWarning = true,
  debounceMs = 200,
  limit = 8,
  staleMs = 30_000,
}: FamilyPickerFieldProps) {
  const reactId = useId();
  const inputId = `family-picker-${reactId}`;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const isHydrated = useIsHydrated();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  const search = trpc.platformAdmin.searchFamilies.useQuery(
    {
      q: debouncedQuery,
      excludeFamilyId,
      limit,
    },
    {
      // Always-on while no family is picked. Backend handles empty q by
      // returning the first N families alphabetically — so this primes the
      // list before the user types anything.
      enabled: !value,
      staleTime: staleMs,
      placeholderData: keepPreviousData,
    },
  );

  const data = search.data ?? [];
  const lowerQuery = query.trim().toLowerCase();

  // Client-side narrow on the cached set using the IMMEDIATE query string.
  // Pre-debounce, this gives an instant-feel filter; post-debounce the
  // server returns the authoritative result for `debouncedQuery` and the
  // list simply updates in place. Using `name` only (not ownerEmail)
  // matches the server's `LIKE` filter so the client view never diverges
  // from a fresh server response. `excludeFamilyIds` is also applied here
  // so callers can exclude multiple families (the server-side
  // `excludeFamilyId` only takes one).
  const excludeSet = useMemo(
    () =>
      excludeFamilyIds && excludeFamilyIds.length > 0
        ? new Set(excludeFamilyIds)
        : null,
    [excludeFamilyIds],
  );
  const visible = useMemo(() => {
    let result: ReadonlyArray<FamilyOption> = data;
    if (excludeSet) {
      result = result.filter((f) => !excludeSet.has(f.id));
    }
    if (lowerQuery) {
      result = result.filter((f) => f.name.toLowerCase().includes(lowerQuery));
    }
    return result;
  }, [data, lowerQuery, excludeSet]);

  const isFetching = isHydrated && search.isFetching;
  const isCold = search.isPending; // no data yet — first fetch
  const isRefetchingInBg = isFetching && !isCold;

  const capExceeded = useMemo(() => {
    if (!value) return false;
    return value.memberCount + 1 > value.maxMembers;
  }, [value]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {label ? <Label htmlFor={inputId}>{label}</Label> : null}
        {value ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-primary/50 bg-primary/5 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{value.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                Owner: {value.ownerEmail} ·{' '}
                <span className="tabular-nums">
                  {value.memberCount}/{value.maxMembers}
                </span>{' '}
                members
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
              aria-label="Choose a different family"
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
                placeholder="Search by family name…"
                className="pl-9 pr-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={disabled}
              />
              {/* Background-refetch indicator. Hidden during the first cold
                  fetch (the result area shows the loading state instead) and
                  during idle states. */}
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

      {showCapWarning && value && capExceeded ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            Adding will make member{' '}
            <strong className="tabular-nums">{value.memberCount + 1}</strong> of
            a <strong className="tabular-nums">{value.maxMembers}</strong> cap.
            Continue only if intentional.
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface SearchResultsProps {
  query: string;
  /** First fetch in flight, no data yet — show full loading state. */
  isCold: boolean;
  /** Any fetch in flight. Used to suppress the "no match" empty state until
   *  the server has had a chance to expand the cached set. */
  isFetching: boolean;
  data: ReadonlyArray<FamilyOption>;
  onPick: (f: FamilyOption) => void;
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
        Loading families…
      </div>
    );
  }

  if (data.length === 0) {
    // Don't lock in "no match" while a refetch is still in flight — the
    // current empty state may just be a stale-cache miss that the in-flight
    // server query will fix in a moment.
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
          No other families yet.
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        <TriangleAlert className="size-3.5" />
        No families match “{query}”.
      </div>
    );
  }

  return (
    <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
      {data.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onPick(f)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{f.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                Owner: {f.ownerEmail}
              </p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {f.memberCount}/{f.maxMembers}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
