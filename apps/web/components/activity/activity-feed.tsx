'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { ActivityEntry } from './activity-entry';
import { ActivityEntrySkeleton } from './activity-entry-skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ACTIVITY_CATEGORIES, type ActivityCategoryKey } from '@/lib/activity-config';
import { groupItemsByDate } from '@/lib/format';

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

interface ActivityFeedProps {
  familyId: string;
  initialItems?: ActivityItem[];
  initialCursor?: string | null;
}

export function ActivityFeed({ familyId, initialItems, initialCursor }: ActivityFeedProps) {
  const [items, setItems] = useState<ActivityItem[]>(initialItems ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor ?? null);
  const [loading, setLoading] = useState(!initialItems);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ActivityCategoryKey>('all');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchActivity = useCallback(
    async (cursor?: string, actionFilter?: string) => {
      const params = new URLSearchParams({ limit: '20' });
      if (cursor) params.set('cursor', cursor);
      if (actionFilter) params.set('action', actionFilter);

      const res = await fetch(
        `/api/families/${familyId}/activity?${params.toString()}`
      );
      if (!res.ok) throw new Error('Failed to load activity');
      return (await res.json()) as ActivityResponse;
    },
    [familyId]
  );

  // Fetch on mount only if no initial data was provided
  useEffect(() => {
    if (initialItems) return;
    setLoading(true);
    setError(null);
    fetchActivity()
      .then((data) => {
        setItems(data.items);
        setNextCursor(data.nextCursor);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fetchActivity, initialItems]);

  // Filter by category
  function handleCategoryChange(key: string) {
    const category = ACTIVITY_CATEGORIES.find((c) => c.key === key);
    setActiveCategory(key as ActivityCategoryKey);
    setLoading(true);
    setError(null);
    setItems([]);
    setNextCursor(null);

    // If category has multiple actions, fetch all and filter client-side
    // If single action, use API filter
    const actionFilter = category?.actions?.length === 1 ? category.actions[0] : undefined;

    fetchActivity(undefined, actionFilter)
      .then((data) => {
        const filtered = category?.actions
          ? data.items.filter((item) => category.actions!.includes(item.action))
          : data.items;
        setItems(filtered);
        setNextCursor(data.nextCursor);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const category = ACTIVITY_CATEGORIES.find((c) => c.key === activeCategory);
      const actionFilter = category?.actions?.length === 1 ? category.actions[0] : undefined;
      const data = await fetchActivity(nextCursor, actionFilter);
      const filtered = category?.actions
        ? data.items.filter((item) => category.actions!.includes(item.action))
        : data.items;
      setItems((prev) => [...prev, ...filtered]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
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
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor, loadingMore, loading]);

  const dateGroups = groupItemsByDate(items, (item) => item.createdAt);

  return (
    <div className="pb-[env(safe-area-inset-bottom)]">
      {/* Filter tabs */}
      <Tabs value={activeCategory} onValueChange={handleCategoryChange}>
        <div className="-mx-3 overflow-x-auto scrollbar-none px-3 sm:mx-0 sm:px-0">
          <TabsList variant="line">
            {ACTIVITY_CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.key} value={cat.key}>
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* Content */}
      <div className="mt-4">
        {loading ? (
          <div className="space-y-0 divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <ActivityEntrySkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="size-12 text-destructive/50" />
            <h2 className="mt-4 text-lg font-semibold">Something went wrong</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => {
                setError(null);
                handleCategoryChange(activeCategory);
              }}
            >
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="size-16 text-muted-foreground/30" />
            <h2 className="mt-4 text-lg font-semibold">No activity recorded yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Activity will appear here as changes are made to your family tree.
            </p>
          </div>
        ) : (
          <div>
            {dateGroups.map((group) => (
              <div key={group.label}>
                {/* Sticky date group header */}
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
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Load more skeleton / sentinel */}
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
    </div>
  );
}
