'use client';

import { useState, useEffect, useCallback } from 'react';
import { ActivityEntry } from './activity-entry';
import { Button } from '@/components/ui/button';

interface ActivityItem {
  id: string;
  userId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

interface ActivityResponse {
  items: ActivityItem[];
  nextCursor: string | null;
}

export function ActivityFeed({ familyId }: { familyId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams({ limit: '20' });
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(
        `/api/families/${familyId}/activity?${params.toString()}`
      );
      if (!res.ok) throw new Error('Failed to load activity');
      return (await res.json()) as ActivityResponse;
    },
    [familyId]
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchActivity()
      .then((data) => {
        setItems(data.items);
        setNextCursor(data.nextCursor);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fetchActivity]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchActivity(nextCursor);
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading activity...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
    );
  }

  return (
    <div>
      <div className="divide-y">
        {items.map((item) => (
          <ActivityEntry
            key={item.id}
            userName={item.userId}
            summary={item.summary}
            createdAt={item.createdAt}
          />
        ))}
      </div>
      {nextCursor && (
        <div className="pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
