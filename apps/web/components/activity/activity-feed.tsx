'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { ActivityEntry } from './activity-entry';
import { ActivityEntrySkeleton } from './activity-entry-skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export interface ActivityFeedMember {
  userId: string;
  name: string | null;
  email: string;
}

interface ActivityFeedProps {
  familyId: string;
  initialItems?: ActivityItem[];
  initialCursor?: string | null;
  /** Optional: family members for the actor filter dropdown. */
  members?: ActivityFeedMember[];
}

export function ActivityFeed({ familyId, initialItems, initialCursor, members }: ActivityFeedProps) {
  const [items, setItems] = useState<ActivityItem[]>(initialItems ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor ?? null);
  const [loading, setLoading] = useState(!initialItems);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ActivityCategoryKey>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchActivity = useCallback(
    async (cursor?: string, actionFilter?: string, userId?: string) => {
      const params = new URLSearchParams({ limit: '20' });
      if (cursor) params.set('cursor', cursor);
      if (actionFilter) params.set('action', actionFilter);
      if (userId) params.set('userId', userId);

      const res = await fetch(
        `/api/families/${familyId}/activity?${params.toString()}`
      );
      if (!res.ok) throw new Error('Failed to load activity');
      return (await res.json()) as ActivityResponse;
    },
    [familyId]
  );

  function categoryActionFilter(key: string): string | undefined {
    const category = ACTIVITY_CATEGORIES.find((c) => c.key === key);
    return category?.actions?.length === 1 ? category.actions[0] : undefined;
  }
  function categoryActionList(key: string): string[] | null {
    const category = ACTIVITY_CATEGORIES.find((c) => c.key === key);
    return category?.actions ?? null;
  }

  // Re-fetch first page whenever a filter changes (mount handled separately).
  const refetchFromFilters = useCallback(
    (categoryKey: ActivityCategoryKey, userId: string) => {
      setLoading(true);
      setError(null);
      setItems([]);
      setNextCursor(null);

      const actionFilter = categoryActionFilter(categoryKey);
      const userIdParam = userId === 'all' ? undefined : userId;

      fetchActivity(undefined, actionFilter, userIdParam)
        .then((data) => {
          const allowed = categoryActionList(categoryKey);
          const filtered = allowed
            ? data.items.filter((item) => allowed.includes(item.action))
            : data.items;
          setItems(filtered);
          setNextCursor(data.nextCursor);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    },
    [fetchActivity],
  );

  // Mount fetch when no initial data was provided
  useEffect(() => {
    if (initialItems) return;
    refetchFromFilters('all', 'all');
  }, [initialItems, refetchFromFilters]);

  function handleCategoryChange(key: string) {
    const next = key as ActivityCategoryKey;
    setActiveCategory(next);
    refetchFromFilters(next, userFilter);
  }

  function handleUserFilterChange(value: string) {
    setUserFilter(value);
    refetchFromFilters(activeCategory, value);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const actionFilter = categoryActionFilter(activeCategory);
      const userIdParam = userFilter === 'all' ? undefined : userFilter;
      const data = await fetchActivity(nextCursor, actionFilter, userIdParam);
      const allowed = categoryActionList(activeCategory);
      const filtered = allowed
        ? data.items.filter((item) => allowed.includes(item.action))
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

      {/* Secondary filters (only when we have a members list to populate from) */}
      {members && members.length > 0 ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">By:</span>
          <Select value={userFilter} onValueChange={handleUserFilterChange}>
            <SelectTrigger size="sm" className="h-8 w-[200px]">
              <SelectValue placeholder="Anyone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name ?? m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

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
