'use client';

import { useMemo, useState } from 'react';
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
  onSaved?: () => void;
  onAskAi?: (prompt: string) => void;
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
  onSaved,
  onAskAi,
}: SearchResultsProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  const toggleGroup = (providerId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
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
      <p className="text-sm text-muted-foreground">
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
                    onSaved={onSaved}
                    onAskAi={onAskAi}
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
