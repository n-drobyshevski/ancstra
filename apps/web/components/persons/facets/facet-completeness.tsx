'use client';

import { Slider } from '@/components/ui/slider';
import { FacetBlock } from './facet-block';
import { usePersonsFilters, useFilterUpdate } from '../use-persons-filters';

export function FacetCompleteness() {
  const { filters } = usePersonsFilters();
  const update = useFilterUpdate();

  const value = filters.complGte ?? 0;
  const active = filters.complGte !== null && filters.complGte > 0;

  return (
    <FacetBlock label="Completeness" active={active}>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
          <span>Min:</span>
          <span>{value}%</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[value]}
          onValueChange={([v]) => update({ complGte: v === 0 ? null : v })}
          aria-label="Minimum completeness"
        />
      </div>
    </FacetBlock>
  );
}
