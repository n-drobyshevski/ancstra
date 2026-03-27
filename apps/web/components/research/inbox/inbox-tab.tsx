'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useInbox } from '@/lib/research/factsheet-client';
import { InboxItemCard } from './inbox-item-card';

export function InboxTab() {
  const { items, total, isLoading, refetch } = useInbox();

  const handleDismiss = useCallback(async (itemId: string) => {
    try {
      const res = await fetch(`/api/research/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, status: 'dismissed' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Item dismissed');
      refetch();
    } catch {
      toast.error('Failed to dismiss');
    }
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium mb-1">Inbox is empty</p>
        <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
          When you search without selecting a person first, saved items appear here for triage.
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href="/research">Go to Search</a>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Unanchored Items</h2>
        <p className="text-xs text-muted-foreground">
          Research items not linked to any person. Assign them or dismiss.
        </p>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <InboxItemCard
            key={item.id}
            item={item}
            onAssign={() => {}}
            onCreateFactsheet={() => {}}
            onDismiss={() => handleDismiss(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
