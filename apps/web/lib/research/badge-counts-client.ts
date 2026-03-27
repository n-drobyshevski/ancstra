'use client';

import { useState, useEffect, useCallback } from 'react';

interface BadgeCounts {
  conflictCount: number;
  hintCount: number;
  factsheetCount: number;
}

export function useBadgeCounts(personId: string) {
  const [counts, setCounts] = useState<BadgeCounts>({
    conflictCount: 0,
    hintCount: 0,
    factsheetCount: 0,
  });

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/research/badge-counts?personId=${personId}`);
      if (!res.ok) return;
      const data: BadgeCounts = await res.json();
      setCounts(data);
    } catch {
      // Silently fail — badge counts are non-critical
    }
  }, [personId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...counts, refetch };
}
