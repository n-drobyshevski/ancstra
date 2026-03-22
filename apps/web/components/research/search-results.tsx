'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { SearchResultCard } from './search-result-card';
import type { SearchResult } from '@ancstra/research';

interface SearchResultsProps {
  results: SearchResult[] | undefined;
  isLoading: boolean;
  error: Error | null;
  query: string;
  onSaved?: () => void;
}

export function SearchResults({
  results,
  isLoading,
  error,
  query,
  onSaved,
}: SearchResultsProps) {
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

  if (!query) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Enter a search query to find historical records across multiple providers.
      </div>
    );
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
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {results.length} result{results.length !== 1 ? 's' : ''} found
      </p>
      {results.map((result) => (
        <SearchResultCard
          key={`${result.providerId}-${result.externalId}`}
          result={result}
          onSaved={onSaved}
        />
      ))}
    </div>
  );
}
