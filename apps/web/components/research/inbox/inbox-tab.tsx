'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useInbox } from '@/lib/research/factsheet-client';
import { InboxItemCard } from './inbox-item-card';

export function InboxTab() {
  const { items, total, isLoading, refetch } = useInbox();
  const router = useRouter();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const committedRef = useRef<Set<string>>(new Set());

  const handleReview = useCallback((itemId: string) => {
    router.push(`/research/item/${itemId}`);
  }, [router]);

  const commitDismiss = useCallback(async (itemId: string) => {
    if (committedRef.current.has(itemId)) return;
    committedRef.current.add(itemId);
    try {
      const res = await fetch(`/api/research/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, status: 'dismissed' }),
      });
      if (!res.ok) throw new Error('Failed');
      refetch();
    } catch {
      toast.error('Failed to dismiss');
      setHiddenIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
      committedRef.current.delete(itemId);
    }
  }, [refetch]);

  const handleDismiss = useCallback((itemId: string) => {
    setHiddenIds((prev) => new Set(prev).add(itemId));
    committedRef.current.delete(itemId);
    toast('Item dismissed', {
      action: {
        label: 'Undo',
        onClick: () => {
          committedRef.current.add(itemId); // prevent onAutoClose from firing
          setHiddenIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
        },
      },
      duration: 4000,
      onAutoClose: () => commitDismiss(itemId),
      onDismiss: () => commitDismiss(itemId),
    });
  }, [commitDismiss]);

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
          When you search without selecting a person first, bookmarks appear here for triage.
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
        {items.filter((item) => !hiddenIds.has(item.id)).map((item) => (
          <InboxItemCard
            key={item.id}
            item={item}
            onReview={() => handleReview(item.id)}
            onDismiss={() => handleDismiss(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
