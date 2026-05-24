'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { InboxItem, InboxItemType, InboxCounts } from '@ancstra/research';
import { InboxFilters } from './inbox-filters';
import { InboxRow } from './inbox-row';

interface InboxListProps {
  locale: string;
  initialItems: InboxItem[];
  initialCounts: InboxCounts;
  initialFilters: {
    type?: InboxItemType | InboxItemType[];
    threadId?: string;
    personId?: string;
  };
}

const ALL_TYPES: InboxItemType[] = ['factsheet_draft', 'ai_proposal', 'conflict', 'hint'];

function parseActiveTypes(typeParam: string | null): InboxItemType[] {
  if (!typeParam) return ALL_TYPES;
  const VALID = new Set(ALL_TYPES);
  const parts = typeParam
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is InboxItemType => VALID.has(s as InboxItemType));
  return parts.length > 0 ? parts : ALL_TYPES;
}

export function InboxList({ locale, initialItems, initialCounts }: InboxListProps) {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<InboxItem[]>(initialItems);
  const [counts, setCounts] = useState<InboxCounts>(initialCounts);
  const [loading, setLoading] = useState(false);

  const activeTypes = parseActiveTypes(searchParams.get('type'));
  const activeThreadId = searchParams.get('threadId') ?? null;

  const queryString = searchParams.toString();

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inbox?${queryString}`);
      if (!res.ok) return;
      const json = await res.json() as { items: InboxItem[]; counts: InboxCounts };
      setItems(json.items);
      setCounts(json.counts);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <div>
      <InboxFilters counts={counts} activeTypes={activeTypes} activeThreadId={activeThreadId} />
      {loading && (
        <div className="text-xs text-muted-foreground mb-2">Refreshing…</div>
      )}
      <div className="space-y-2">
        {items.map((item) => (
          <InboxRow key={item.id} item={item} locale={locale} />
        ))}
      </div>
    </div>
  );
}
