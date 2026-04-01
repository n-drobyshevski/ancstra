// apps/web/lib/tree/use-quality-data.ts
'use client';

import { useMemo } from 'react';
import type { PersonListItem } from '@ancstra/shared';

export interface QualityEntry {
  id: string;
  score: number;
  missingFields: string[];
}

/**
 * Compute quality scores client-side from existing tree data.
 * Scoring (max 80 from available fields):
 *   - Name (given + surname): 20
 *   - Birth date: 25
 *   - Death date: 15
 *   - Birth place / source not available from summary — omitted (20+20)
 */
export function useQualityData(
  enabled: boolean,
  persons?: PersonListItem[],
) {
  const qualityData = useMemo(() => {
    if (!enabled || !persons) return new Map<string, QualityEntry>();

    const map = new Map<string, QualityEntry>();
    for (const p of persons) {
      const missingFields: string[] = [];
      let score = 0;

      if (p.givenName && p.surname) {
        score += 20;
      } else {
        missingFields.push('name');
      }

      if (p.birthDate) {
        score += 25;
      } else {
        missingFields.push('birthDate');
      }

      if (p.deathDate) {
        score += 15;
      } else if (!p.isLiving) {
        // Only flag missing death date for non-living persons
        missingFields.push('deathDate');
      }

      map.set(p.id, { id: p.id, score, missingFields });
    }
    return map;
  }, [enabled, persons]);

  return { qualityData };
}
