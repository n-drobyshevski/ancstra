'use client';

import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { useResearchItems } from '@/lib/research/search-client';
import { ResearchItemCard } from './research-item-card';
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
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <Bookmark className="mx-auto mb-2 size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Bookmark results to track them here.
          </p>
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
