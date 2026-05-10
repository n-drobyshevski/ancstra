'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Notebook } from 'lucide-react';
import { toast } from 'sonner';
import { CommandCenter } from './command-center';
import { SearchResults } from './search-results';
import { BookmarksPanel } from './bookmarks-panel';
import { ResearchInput, type ResearchInputHandle } from './research-input';
import { TextPasteModal } from './text-paste-modal';
import { SourceSelector } from './source-selector';
import { Button } from '@/components/ui/button';
import { useResearchSearch, useResearchItems } from '@/lib/research/search-client';
import { addRecentSearch } from '@/lib/research/search-history';
import { addActivity } from '@/lib/research/activity';
import { cn } from '@/lib/utils';

interface ResearchHubProps {
  onAskAi?: (prompt: string) => void;
  onOpenAiPanel?: () => void;
  onSearchContextChange?: (ctx: { query: string; topResults: { title: string; providerId: string }[] } | null) => void;
  aiPanelOpen?: boolean;
}

export function ResearchHub({ onAskAi, onOpenAiPanel, onSearchContextChange, aiPanelOpen }: ResearchHubProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [bookmarkRefreshKey, setBookmarkRefreshKey] = useState(0);
  const inputRef = useRef<ResearchInputHandle>(null);

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
    refetch: refetchItems,
  } = useResearchItems();

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (q.trim()) {
      addRecentSearch(q.trim());
      addActivity({ type: 'search', title: q.trim() });
    }
    const params = new URLSearchParams(searchParams.toString());
    if (q) {
      params.set('q', q);
    } else {
      params.delete('q');
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, router, pathname]);

  const handleBookmark = useCallback(() => {
    refetchItems();
    setBookmarkRefreshKey((k) => k + 1);
  }, [refetchItems]);

  const handleScrapeUrl = useCallback(() => {
    inputRef.current?.focusUrlMode();
  }, []);

  const handlePasteText = useCallback(() => {
    setTextModalOpen(true);
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

  const hasQuery = !!query;

  return (
    <div className="space-y-4">
      {/* Top bar: search + source filter */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
        <div className="flex-1">
          <ResearchInput
            ref={inputRef}
            onSearch={handleSearch}
            onBookmark={handleBookmark}
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

      <div className="motion-safe:transition-opacity motion-safe:duration-200">
        {hasQuery ? (
          /* ── Search active: results + sidebar ── */
          <div className="space-y-2">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={async () => {
                  const res = await fetch('/api/research/threads', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: `Search: ${query}` }),
                  });
                  if (!res.ok) {
                    toast.error('Failed to start thread');
                    return;
                  }
                  const created = await res.json();
                  await fetch('/api/research/threads/active', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ threadId: created.id }),
                  });
                  toast.success('Thread started', { description: created.title });
                  window.location.reload();
                }}
              >
                <Notebook className="size-3 mr-1" />
                Start thread from this search
              </Button>
            </div>
            <div className={cn(
              'grid gap-6',
              aiPanelOpen ? 'grid-cols-1' : 'lg:grid-cols-[1fr_280px]'
            )}>
              <SearchResults
                results={searchData?.results}
                isLoading={searchLoading}
                error={searchError}
                query={query}
                onBookmark={handleBookmark}
                onAskAi={onAskAi}
                bookmarkedUrls={bookmarkedUrls}
              />
              {!aiPanelOpen && (
                <div className="hidden lg:block">
                  <BookmarksPanel mode="sidebar" refreshKey={bookmarkRefreshKey} />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Landing: command center ── */
          <CommandCenter
            onSearch={handleSearch}
            onScrapeUrl={handleScrapeUrl}
            onPasteText={handlePasteText}
            onOpenAi={onOpenAiPanel ?? (() => {})}
            bookmarkRefreshKey={bookmarkRefreshKey}
            aiPanelOpen={aiPanelOpen}
          />
        )}
      </div>
    </div>
  );
}
