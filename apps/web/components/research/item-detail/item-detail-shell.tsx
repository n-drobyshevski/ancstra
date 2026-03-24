'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ItemHeader } from './item-header';
import { ItemContent } from './item-content';
import { ItemSidebar } from './item-sidebar';
import { useScrapeJob } from '@/lib/research/scrape-job-poller';

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
  const [scrapeJobId, setScrapeJobId] = useState<string | null>(null);

  const handleStatusChange = (newStatus: string) => {
    setItem((prev) => ({ ...prev, status: newStatus }));
  };

  const handleNotesChange = (notes: string) => {
    setItem((prev) => ({ ...prev, notes }));
  };

  const handleDeleted = () => {
    // Navigation happens in ItemHeader
  };

  const refreshItem = useCallback(async (): Promise<ResearchItemData | null> => {
    const res = await fetch(`/api/research/items/${initialItem.id}`);
    if (res.ok) {
      const data = await res.json();
      setItem(data);
      return data;
    }
    return null;
  }, [initialItem.id]);

  const scrapeJob = useScrapeJob(scrapeJobId, {
    onCompleted: async () => {
      await refreshItem();
      toast.success(`Scraped ${new URL(item.url!).hostname} — full text extracted`);
      setScrapeJobId(null);
    },
    onFailed: (error) => {
      toast.error(`Could not scrape ${new URL(item.url!).hostname}`, {
        description: error,
      });
      setScrapeJobId(null);
    },
    onTimeout: () => {
      toast.info('Scrape is taking longer than expected');
      setScrapeJobId(null);
    },
  });

  return (
    <div className="space-y-6">
      <ItemHeader
        item={item}
        onStatusChange={handleStatusChange}
        onDeleted={handleDeleted}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ItemContent item={item} onNotesChange={handleNotesChange} onRefresh={refreshItem} onScrapeJobStarted={setScrapeJobId} scrapeJobStatus={scrapeJobId ? scrapeJob.status : null} />
        <ItemSidebar item={item} />
      </div>
    </div>
  );
}
