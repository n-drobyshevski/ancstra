'use client';

import { useState } from 'react';
import { ItemHeader } from './item-header';
import { ItemContent } from './item-content';
import { ItemSidebar } from './item-sidebar';

interface ResearchItemData {
  id: string;
  title: string;
  url: string | null;
  snippet: string | null;
  fullText: string | null;
  notes: string | null;
  status: string;
  providerId: string | null;
  providerRecordId: string | null;
  discoveryMethod: string;
  searchQuery: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  personIds: string[];
}

interface ItemDetailShellProps {
  item: ResearchItemData;
}

export function ItemDetailShell({ item: initialItem }: ItemDetailShellProps) {
  const [item, setItem] = useState(initialItem);

  const handleStatusChange = (newStatus: string) => {
    setItem((prev) => ({ ...prev, status: newStatus }));
  };

  const handleNotesChange = (notes: string) => {
    setItem((prev) => ({ ...prev, notes }));
  };

  const handleDeleted = () => {
    // Navigation happens in ItemHeader
  };

  return (
    <div className="space-y-6">
      <ItemHeader
        item={item}
        onStatusChange={handleStatusChange}
        onDeleted={handleDeleted}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ItemContent item={item} onNotesChange={handleNotesChange} />
        <ItemSidebar item={item} />
      </div>
    </div>
  );
}
