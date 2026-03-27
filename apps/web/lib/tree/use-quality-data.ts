// apps/web/lib/tree/use-quality-data.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

export interface QualityEntry {
  id: string;
  score: number;
  missingFields: string[];
}

export function useQualityData(enabled: boolean) {
  const [data, setData] = useState<Map<string, QualityEntry>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!enabled) {
      setData(new Map());
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/quality/priorities?page=1&pageSize=10000');
      if (!res.ok) throw new Error('Failed to fetch quality data');
      const json = await res.json();
      const map = new Map<string, QualityEntry>();
      for (const p of json.persons) {
        map.set(p.id, { id: p.id, score: p.score, missingFields: p.missingFields });
      }
      setData(map);
    } catch {
      setData(new Map());
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { qualityData: data, isLoading };
}
