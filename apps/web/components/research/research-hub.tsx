'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Globe, Newspaper, BookOpen, Archive, Bookmark, ChevronsRight } from 'lucide-react';
import { ResearchInput } from './research-input';
import { SearchResults } from './search-results';
import { ResearchItemCard } from './research-item-card';
import { TextPasteModal } from './text-paste-modal';
import { SourceSelector } from './source-selector';
import { useResearchSearch, useResearchItems } from '@/lib/research/search-client';
import { addRecentSearch, EXAMPLE_SEARCHES } from '@/lib/research/search-history';
import { cn } from '@/lib/utils';

const PROVIDERS = [
  { icon: Globe, name: 'FamilySearch', desc: '6B+ records' },
  { icon: Archive, name: 'NARA', desc: 'US National Archives' },
  { icon: Newspaper, name: 'Newspapers', desc: 'Chronicling America' },
  { icon: BookOpen, name: 'More sources', desc: 'coming soon' },
];

interface ResearchHubProps {
  onAskAi?: (prompt: string) => void;
  onSearchContextChange?: (ctx: { query: string; topResults: { title: string; providerId: string }[] } | null) => void;
}

export function ResearchHub({ onAskAi, onSearchContextChange }: ResearchHubProps) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  const providerParam = selectedProviders.length > 0 && selectedProviders.length < 8
    ? selectedProviders.join(',')
    : undefined;

  const {
    data: searchData,
    isLoading: searchLoading,
    error: searchError,
  } = useResearchSearch(query, !!query, providerParam);

  const {
    data: itemsData,
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useResearchItems();

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (q.trim()) addRecentSearch(q.trim());
    // Sync to URL without triggering Next.js navigation
    const url = new URL(window.location.href);
    if (q) {
      url.searchParams.set('q', q);
    } else {
      url.searchParams.delete('q');
    }
    window.history.replaceState(null, '', url.toString());
  }, []);

  const handleBookmark = useCallback(() => {
    refetchItems();
  }, [refetchItems]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ancstra:sidebar-collapsed') === 'true';
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ancstra:sidebar-collapsed', String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!query || !searchData?.results) {
      onSearchContextChange?.(null);
      return;
    }
    onSearchContextChange?.({
      query,
      topResults: searchData.results.slice(0, 5).map((r) => ({
        title: r.title,
        providerId: r.providerId,
      })),
    });
  }, [query, searchData, onSearchContextChange]);

  const bookmarkedUrls = useMemo(() => {
    const set = new Set<string>();
    if (itemsData?.items) {
      for (const item of itemsData.items) {
        if (item.url) set.add(item.url);
      }
    }
    return set;
  }, [itemsData?.items]);

  const hasResults = !!query && (searchData?.results?.length ?? 0) > 0;
  const hasItems = (itemsData?.items?.length ?? 0) > 0;
  const showEmptyState = !query && !searchLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Research</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search historical records across multiple sources
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasItems && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bookmark className="size-4" />
              {itemsData?.items.length} bookmarks
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
        <div className="flex-1">
          <ResearchInput
            onSearch={handleSearch}
            onBookmark={handleBookmark}
            onOpenTextModal={() => setTextModalOpen(true)}
            externalQuery={query}
          />
        </div>
        <SourceSelector onSelectionChange={setSelectedProviders} />
      </div>

      <TextPasteModal
        open={textModalOpen}
        onOpenChange={setTextModalOpen}
        onBookmark={handleBookmark}
      />

      {showEmptyState ? (
        /* ── Empty state: confident guide ── */
        <div className="space-y-8 pt-4">
          {/* Quick start */}
          <div className="mx-auto max-w-2xl space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Start researching
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {EXAMPLE_SEARCHES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => handleSearch(example)}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left text-sm transition-colors hover:border-accent/50 hover:bg-accent/10"
                >
                  <Search className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                  <span className="text-foreground">{example}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Available sources */}
          <div className="mx-auto max-w-2xl space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Available sources
            </h2>
            <div className="grid gap-3 sm:grid-cols-4">
              {PROVIDERS.map(({ icon: Icon, name, desc }) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => handleSearch(name)}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center transition-all hover:shadow-sm hover:border-primary/20 cursor-pointer"
                >
                  <Icon className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="mx-auto max-w-2xl space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              How it works
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>
                  <h3 className="text-sm font-medium">Search</h3>
                </div>
                <p className="text-xs text-muted-foreground pl-8">
                  Enter a name, date, or place. Results come from multiple sources at once.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">2</span>
                  <h3 className="text-sm font-medium">Bookmark</h3>
                </div>
                <p className="text-xs text-muted-foreground pl-8">
                  Bookmark results as research items. Tag them to people in your tree.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">3</span>
                  <h3 className="text-sm font-medium">Analyze</h3>
                </div>
                <p className="text-xs text-muted-foreground pl-8">
                  Open the evidence workspace to compare sources and resolve conflicts.
                </p>
              </div>
            </div>
          </div>

          {/* Bookmarks in empty state */}
          {hasItems && (
            <div className="mx-auto max-w-2xl space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Bookmarks ({itemsData?.items.length})
              </h2>
              <div className="space-y-3">
                {itemsData?.items.map((item: any) => (
                  <ResearchItemCard
                    key={item.id}
                    item={item}
                    onUpdated={handleBookmark}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Active state: results + sidebar ── */
        <div className={cn(
          'grid gap-6',
          !sidebarCollapsed ? 'lg:grid-cols-[1fr_320px]' : 'grid-cols-1'
        )}>
          <div className="relative">
            {/* Collapsed sidebar badge */}
            {sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="absolute -top-1 right-0 z-10 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground"
              >
                <Bookmark className="size-3.5" />
                {itemsData?.items.length ?? 0} bookmarks
              </button>
            )}
            <SearchResults
              results={searchData?.results}
              isLoading={searchLoading}
              error={searchError}
              query={query}
              onBookmark={handleBookmark}
              onAskAi={onAskAi}
              bookmarkedUrls={bookmarkedUrls}
            />
          </div>

          {!sidebarCollapsed && (
            <div className="hidden space-y-3 lg:block">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Bookmarks <span className="text-foreground">({itemsData?.items.length ?? 0})</span>
                </h2>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Collapse sidebar"
                >
                  <ChevronsRight className="size-4" />
                </button>
              </div>
              {itemsLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : !hasItems ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <Bookmark className="mx-auto size-5 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Bookmark search results to track them here.
                  </p>
                </div>
              ) : (
                itemsData?.items.map((item: any) => (
                  <ResearchItemCard
                    key={item.id}
                    item={item}
                    onUpdated={handleBookmark}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
