'use client';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FacetBlock } from './facet-block';
import { usePersonsFilters, useFilterUpdate } from '../use-persons-filters';
import { CITATIONS_VALUES } from '@/lib/persons/search-params';

const CITATIONS_LABELS: Record<typeof CITATIONS_VALUES[number], string> = {
  any: 'Any',
  none: 'No sources',
  gte1: '1 or more',
  gte3: '3 or more',
};

export function FacetCitations() {
  const { filters } = usePersonsFilters();
  const update = useFilterUpdate();
  const active = filters.citations !== 'any';

  return (
    <FacetBlock label="Sources" active={active}>
      <RadioGroup
        value={filters.citations}
        onValueChange={(v) => update({ citations: v as typeof CITATIONS_VALUES[number] })}
        className="space-y-1.5"
        aria-label="Source citation count"
      >
        {CITATIONS_VALUES.map((v) => {
          const id = `citations-${v}`;
          return (
            <label key={v} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem id={id} value={v} />
              <span>{CITATIONS_LABELS[v]}</span>
            </label>
          );
        })}
      </RadioGroup>
    </FacetBlock>
  );
}
