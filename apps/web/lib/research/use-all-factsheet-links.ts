'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FactsheetLink, Factsheet } from '@/lib/research/factsheet-client';

export function useAllFactsheetLinks(factsheets: Factsheet[]) {
  const [links, setLinks] = useState<FactsheetLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Stable key derived from factsheet IDs so the effect only re-runs when
  // the actual set of factsheets changes, not on every render.
  const fsIds = useMemo(() => factsheets.map((f) => f.id), [factsheets]);
  const fsKey = fsIds.join(',');

  const fetchLinks = useCallback(async () => {
    if (fsIds.length === 0) {
      setLinks([]);
      return;
    }
    setIsLoading(true);
    try {
      const allLinks: FactsheetLink[] = [];
      const seenIds = new Set<string>();
      for (const id of fsIds) {
        const res = await fetch(`/api/research/factsheets/${id}/links`);
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
  }, [fsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return { links, isLoading, refetch: fetchLinks };
}
