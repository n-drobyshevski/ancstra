'use client';

import { useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  usePersonResearchItems,
  usePersonFacts,
} from '@/lib/research/evidence-client';
import { SourceListPanel } from './source-list-panel';
import { FactMatrix } from './fact-matrix';
import { DetailPanel } from './detail-panel';

interface BoardTabProps {
  personId: string;
}

export function BoardTab({ personId }: BoardTabProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedItemId = searchParams.get('item');

  const { items, refetch: refetchItems } = usePersonResearchItems(personId);
  const { facts, refetch: refetchFacts } = usePersonFacts(personId);

  const selectedItem = items.find((it) => it.id === selectedItemId) ?? null;

  const setSelectedItem = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('item', id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  const handleDataChanged = useCallback(() => {
    refetchItems();
    refetchFacts();
  }, [refetchItems, refetchFacts]);

  return (
    <div className="grid grid-cols-[280px_1fr_320px] h-[calc(100vh-16rem)] divide-x divide-border rounded-lg border border-border overflow-hidden">
      <SourceListPanel
        items={items}
        facts={facts}
        selectedItemId={selectedItemId}
        onSelectItem={setSelectedItem}
      />
      <FactMatrix facts={facts} items={items} />
      <DetailPanel
        item={selectedItem}
        facts={facts}
        personId={personId}
        onDataChanged={handleDataChanged}
      />
    </div>
  );
}
