'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/format';
import { getActionConfig } from '@/lib/activity-config';

interface ActivityEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export function RecentActivity({ familyId }: { familyId: string }) {
  const [items, setItems] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchActivity() {
      try {
        const res = await fetch(`/api/families/${familyId}/activity?limit=5`);
        if (!res.ok) throw new Error('Failed to fetch activity');
        const data = (await res.json()) as { items: ActivityEntry[] };
        if (!cancelled) {
          setItems(data.items);
        }
      } catch {
        // Leave items empty — empty state handles the display
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchActivity();

    return () => {
      cancelled = true;
    };
  }, [familyId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/activity">View all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-2 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No recent activity</p>
        ) : (
          <ul role="list" className="space-y-0">
            {items.map((item) => {
              const config = getActionConfig(item.action);
              return (
                <li key={item.id} className="flex items-center gap-3 py-2">
                  <div className={`size-2 shrink-0 rounded-full ${config.color.replace('text-', 'bg-')}`} />
                  <span className="text-sm flex-1 min-w-0 truncate">{item.summary}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
