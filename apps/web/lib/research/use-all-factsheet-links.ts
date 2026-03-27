'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FactsheetLink, Factsheet } from '@/lib/research/factsheet-client';

export function useAllFactsheetLinks(factsheets: Factsheet[]) {
  const [links, setLinks] = useState<FactsheetLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLinks = useCallback(async () => {
    if (factsheets.length === 0) {
      setLinks([]);
      return;
    }
    setIsLoading(true);
    try {
      const allLinks: FactsheetLink[] = [];
      const seenIds = new Set<string>();
      for (const fs of factsheets) {
        const res = await fetch(`/api/research/factsheets/${fs.id}/links`);
        if (!res.ok) continue;
        const data = await res.json();
        for (const link of (data.links ?? []) as FactsheetLink[]) {
          if (!seenIds.has(link.id)) {
            seenIds.add(link.id);
            allLinks.push(link);
          }
        }
      }
      setLinks(allLinks);
    } catch {
      setLinks([]);
    } finally {
      setIsLoading(false);
    }
  }, [factsheets]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return { links, isLoading, refetch: fetchLinks };
}
