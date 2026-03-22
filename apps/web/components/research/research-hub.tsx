'use client';

import { useState, useCallback } from 'react';
import { SearchBar } from './search-bar';
import { SearchResults } from './search-results';
import { ResearchItemCard } from './research-item-card';
import { useResearchSearch, useResearchItems } from '@/lib/research/search-client';

export function ResearchHub() {
  const [query, setQuery] = useState('');

  const {
    data: searchData,
    isLoading: searchLoading,
    error: searchError,
  } = useResearchSearch(query, !!query);

  const {
    data: itemsData,
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useResearchItems();

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const handleSaved = useCallback(() => {
    refetchItems();
  }, [refetchItems]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Research</h1>
      </div>

      <SearchBar onSearch={handleSearch} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main: search results */}
        <div>
          <SearchResults
            results={searchData?.results}
            isLoading={searchLoading}
            error={searchError}
            query={query}
            onSaved={handleSaved}
          />
        </div>

        {/* Sidebar: saved research items */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Saved Items</h2>
          {itemsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : itemsData?.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved items yet. Save search results to track them here.
            </p>
          ) : (
            itemsData?.items.map((item) => (
              <ResearchItemCard
                key={item.id}
                item={item}
                onUpdated={handleSaved}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
