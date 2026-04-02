'use client';

import Link from 'next/link';
import { Bookmark, Search } from 'lucide-react';
import { useResearchItems } from '@/lib/research/search-client';
import { ResearchItemCard } from './research-item-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BookmarksPanelProps {
  mode: 'landing' | 'sidebar';
  refreshKey?: number;
}

export function BookmarksPanel({ mode, refreshKey }: BookmarksPanelProps) {
  const { data, isLoading } = useResearchItems();
  const items = data?.items ?? [];
  const displayItems = mode === 'landing' ? items.slice(0, 5) : items;

  return (
    <div className={cn(mode === 'sidebar' && 'sticky top-4')}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Bookmarks{' '}
          <span className="text-foreground">({items.length})</span>
        </h2>
        {mode === 'landing' && items.length > 5 && (
          <Link
            href="/research/bookmarks"
            className="text-xs text-primary hover:underline"
          >
            View all →
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-5 text-center">
          <Bookmark className="mx-auto mb-2 size-6 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground mb-1">
            No bookmarks yet
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Search for records and bookmark them to track your research.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => document.querySelector<HTMLInputElement>('[aria-label="Search records or paste a URL"]')?.focus()}
          >
            <Search className="size-3.5" />
            Start searching
          </Button>
        </div>
      ) : (
        <div className={cn('flex flex-col', mode === 'sidebar' ? 'gap-2' : 'gap-2.5')}>
          {displayItems.map((item: any) => (
            <ResearchItemCard
              key={item.id}
              item={item}
              compact={mode === 'sidebar'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
