'use client';

import { useMemo, useState, useCallback } from 'react';

const COLLAPSED_STORAGE_KEY = 'ancstra:collapsed-providers';

function loadCollapsed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchResultCard } from './search-result-card';
import { getProviderConfig } from './provider-badge';
import type { SearchResult } from '@ancstra/research';

interface SearchResultsProps {
  results: SearchResult[] | undefined;
  isLoading: boolean;
  error: Error | null;
  query: string;
  onBookmark?: () => void;
  onAskAi?: (prompt: string) => void;
  bookmarkedUrls?: Set<string>;
}

interface ProviderGroup {
  providerId: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  results: SearchResult[];
}

export function SearchResults({
  results,
  isLoading,
  error,
  query,
  onBookmark,
  onAskAi,
  bookmarkedUrls,
}: SearchResultsProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);

  const groups = useMemo(() => {
    if (!results || results.length === 0) return [];

    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.providerId) ?? [];
      list.push(r);
      map.set(r.providerId, list);
    }

    const sorted: ProviderGroup[] = [...map.entries()]
      .sort((a, b) => {
        const countDiff = b[1].length - a[1].length;
        if (countDiff !== 0) return countDiff;
        return a[0].localeCompare(b[0]);
      })
      .map(([providerId, providerResults]) => {
        const config = getProviderConfig(providerId);
        return {
          providerId,
          label: config.label,
          icon: config.icon,
          results: providerResults,
        };
      });

    return sorted;
  }, [results]);

  const toggleGroup = useCallback((providerId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-28" />
        {[0, 1].map((g) => (
          <div key={g} className="space-y-2">
            {/* Group header skeleton */}
            <div className="flex items-center gap-2">
              <Skeleton className="size-3.5 rounded" />
              <Skeleton className="size-3.5 rounded" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-6" />
            </div>
            {/* Card skeletons */}
            <div className="space-y-3">
              {[0, 1].map((c) => (
                <div key={c} className="rounded-xl border border-l-3 border-l-muted p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-3/4" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-7 w-24 rounded-md" />
                    <Skeleton className="h-7 w-16 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Search failed: {error.message}
      </div>
    );
  }

  // Empty state now handled by ResearchHub, not here
  if (!query) {
    return null;
  }

  if (results && results.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No results found for &ldquo;{query}&rdquo;. Try a different search term.
      </div>
    );
  }

  if (!results) return null;

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {results.length} result{results.length !== 1 ? 's' : ''} found
      </p>
      {groups.map((group) => {
        const Icon = group.icon;
        const isCollapsed = collapsed.has(group.providerId);

        return (
          <div key={group.providerId} className="space-y-2">
            <button
              type="button"
              onClick={() => toggleGroup(group.providerId)}
              className="flex w-full items-center gap-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? (
                <ChevronRight className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              <Icon className="size-3.5" />
              <span>{group.label}</span>
              <span className="text-xs font-normal">({group.results.length})</span>
            </button>
            {!isCollapsed && (
              <div className="space-y-3">
                {group.results.map((result) => (
                  <SearchResultCard
                    key={`${result.providerId}-${result.externalId}`}
                    result={result}
                    onBookmark={onBookmark}
                    onAskAi={onAskAi}
                    isBookmarked={!!result.url && !!bookmarkedUrls?.has(result.url)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
