'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ActivityEntry } from './activity-entry';
import { ActivityEntrySkeleton } from './activity-entry-skeleton';
import { Button } from '@/components/ui/button';
import {
  ActivityFilterBar,
  rangeForPreset,
  type ActivityFilters,
  type ActivityFeedMember,
} from './activity-filter-bar';
import type { ActivityCategoryKey } from '@/lib/activity-config';
import {
  filterEntriesByVisibility,
  type ActivityVisibility,
} from '@/lib/activity-visibility';
import { useGroupItemsByRelativeBucket } from '@/lib/format-client';

interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface ActivityResponse {
  items: ActivityItem[];
  nextCursor: string | null;
}

export type { ActivityFeedMember };

interface ActivityFeedProps {
  familyId: string;
  visibility: ActivityVisibility;
  initialItems?: ActivityItem[];
  initialCursor?: string | null;
  /** Optional: family members for the actor filter dropdown. */
  members?: ActivityFeedMember[];
}

const INITIAL_FILTERS: ActivityFilters = {
  category: 'all',
  userId: 'all',
  q: '',
  datePreset: 'all',
};

function tabActions(
  visibility: ActivityVisibility,
  category: ActivityCategoryKey,
): string[] | null {
  if (category === 'all') return null;
  const cat = visibility.categories.find((c) => c.key === category);
  return cat?.actions ?? [];
}

export function ActivityFeed({
  familyId,
  visibility,
  initialItems,
  initialCursor,
  members,
}: ActivityFeedProps) {
  const tPage = useTranslations('activity.page');
  const tCommon = useTranslations('common');
  const [items, setItems] = useState<ActivityItem[]>(() =>
    initialItems ? filterEntriesByVisibility(initialItems, visibility) : [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor ?? null);
  const [loading, setLoading] = useState(!initialItems);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActivityFilters>(INITIAL_FILTERS);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildParams = useCallback(
    (f: ActivityFilters, cursor?: string | null) => {
      const params = new URLSearchParams({ limit: '20' });
      // Only forward `action` when the tab maps to exactly one action; otherwise
      // the role allowlist on the server already constrains the result and the
      // client narrows further with `tabActions` below.
      const actions = tabActions(visibility, f.category);
      if (actions && actions.length === 1) {
        params.set('action', actions[0]);
      }
      if (f.userId !== 'all') params.set('userId', f.userId);
      if (f.q.trim()) params.set('q', f.q.trim());
      const range = rangeForPreset(f.datePreset);
      if (range.since) params.set('since', range.since);
      if (range.until) params.set('until', range.until);
      if (cursor) params.set('cursor', cursor);
      return params;
    },
    [visibility],
  );

  const narrowToTab = useCallback(
    (rows: ActivityItem[], category: ActivityCategoryKey) => {
      const allowed = tabActions(visibility, category);
      if (!allowed) return filterEntriesByVisibility(rows, visibility);
      const allowedSet = new Set(allowed);
      return rows.filter((r) => allowedSet.has(r.action));
    },
    [visibility],
  );

  const fetchActivity = useCallback(
    async (params: URLSearchParams) => {
      const res = await fetch(
        `/api/families/${familyId}/activity?${params.toString()}`,
      );
      if (!res.ok) throw new Error(tPage('loadFailed'));
      return (await res.json()) as ActivityResponse;
    },
    [familyId, tPage],
  );

  const refetch = useCallback(
    (nextFilters: ActivityFilters) => {
      setLoading(true);
      setError(null);
      setItems([]);
      setNextCursor(null);

      fetchActivity(buildParams(nextFilters))
        .then((data) => {
          setItems(narrowToTab(data.items, nextFilters.category));
          setNextCursor(data.nextCursor);
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : tPage('loadFailed')),
        )
        .finally(() => setLoading(false));
    },
    [buildParams, fetchActivity, narrowToTab, tPage],
  );

  // Initial mount fetch when no SSR data was provided.
  useEffect(() => {
    if (initialItems) return;
    refetch(INITIAL_FILTERS);
  }, [initialItems, refetch]);

  function handleFiltersChange(next: ActivityFilters) {
    setFilters(next);
    refetch(next);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchActivity(buildParams(filters, nextCursor));
      setItems((prev) => [...prev, ...narrowToTab(data.items, filters.category)]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : tPage('loadMoreFailed'));
    } finally {
      setLoadingMore(false);
    }
  }

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loadingMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor, loadingMore, loading]);

  const groupByBucket = useGroupItemsByRelativeBucket();
  const dateGroups = groupByBucket(items, (item) => item.createdAt);

  return (
    <div className="space-y-4 pb-[env(safe-area-inset-bottom)]">
      <ActivityFilterBar
        visibility={visibility}
        members={members}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {loading ? (
        <div className="space-y-0 divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <ActivityEntrySkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="size-12 text-destructive/50" />
          <h2 className="mt-4 text-lg font-semibold">{tCommon('states.somethingWentWrong')}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              setError(null);
              refetch(filters);
            }}
          >
            {tCommon('buttons.tryAgain')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Activity className="size-16 text-muted-foreground/30" />
          <h2 className="mt-4 text-lg font-semibold">{tPage('noActivityHere')}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {tPage('tryClearingFilters')}
          </p>
        </div>
      ) : (
        <div>
          {dateGroups.map((group) => (
            <div key={group.label}>
              <div className="sticky top-0 z-10 bg-background/95 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                {group.label}
              </div>
              <div className="divide-y">
                {group.items.map((item) => (
                  <ActivityEntry
                    key={item.id}
                    userName={item.userName}
                    userAvatarUrl={item.userAvatarUrl}
                    action={item.action}
                    entityType={item.entityType}
                    entityId={item.entityId}
                    summary={item.summary}
                    createdAt={item.createdAt}
                    metadata={item.metadata}
                  />
                ))}
              </div>
            </div>
          ))}

          {loadingMore && (
            <div className="divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <ActivityEntrySkeleton key={i} />
              ))}
            </div>
          )}
          {nextCursor && <div ref={sentinelRef} className="h-px" />}
        </div>
      )}
    </div>
  );
}
