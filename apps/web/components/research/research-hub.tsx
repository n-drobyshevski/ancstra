'use client';

import { useState, useCallback } from 'react';
import { Search, Globe, Newspaper, BookOpen, Archive, Bookmark, FileText } from 'lucide-react';
import { SearchBar } from './search-bar';
import { SearchResults } from './search-results';
import { ResearchItemCard } from './research-item-card';
import { UrlPasteInput } from './url-paste-input';
import { TextPasteModal } from './text-paste-modal';
import { SourceSelector } from './source-selector';
import { Button } from '@/components/ui/button';
import { useResearchSearch, useResearchItems } from '@/lib/research/search-client';

const EXAMPLE_SEARCHES = [
  'Maria Kowalski born 1885',
  'Chicago Tribune obituary 1952',
  'Census records Cook County IL',
  'Ship manifest Hamburg 1890',
];

const PROVIDERS = [
  { icon: Globe, name: 'FamilySearch', desc: '6B+ records' },
  { icon: Archive, name: 'NARA', desc: 'US National Archives' },
  { icon: Newspaper, name: 'Newspapers', desc: 'Chronicling America' },
  { icon: BookOpen, name: 'More sources', desc: 'coming soon' },
];

export function ResearchHub() {
  const [query, setQuery] = useState('');
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
  }, []);

  const handleSaved = useCallback(() => {
    refetchItems();
  }, [refetchItems]);

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTextModalOpen(true)}
          >
            <FileText className="size-3.5" />
            Paste Text
          </Button>
          {hasItems && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bookmark className="size-4" />
              {itemsData?.items.length} saved
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <SearchBar onSearch={handleSearch} />
        </div>
        <SourceSelector onSelectionChange={setSelectedProviders} />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or paste a URL</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <UrlPasteInput onSaved={handleSaved} />

      <TextPasteModal
        open={textModalOpen}
        onOpenChange={setTextModalOpen}
        onSaved={handleSaved}
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
                  <h3 className="text-sm font-medium">Save</h3>
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
        </div>
      ) : (
        /* ── Active state: results + sidebar ── */
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <SearchResults
              results={searchData?.results}
              isLoading={searchLoading}
              error={searchError}
              query={query}
              onSaved={handleSaved}
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Saved Items {hasItems && <span className="text-foreground">({itemsData?.items.length})</span>}
            </h2>
            {itemsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !hasItems ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <Bookmark className="mx-auto size-5 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Save search results to track them here.
                </p>
              </div>
            ) : (
              itemsData?.items.map((item: any) => (
                <ResearchItemCard
                  key={item.id}
                  item={item}
                  onUpdated={handleSaved}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
