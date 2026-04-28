'use client';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FacetBlock } from '@/components/persons/facets/facet-block';
import { useTreeTableFilters, useTreeFilterUpdate } from '../use-tree-table-filters';
import { TREE_CITATIONS_VALUES } from '@/lib/tree/search-params';

const CITATIONS_LABELS: Record<typeof TREE_CITATIONS_VALUES[number], string> = {
  any: 'Any',
  none: 'No sources',
  gte1: '1 or more',
  gte3: '3 or more',
};

export function FacetCitations() {
  const { filters } = useTreeTableFilters();
  const update = useTreeFilterUpdate();
  const active = filters.citations !== 'any';

  return (
    <FacetBlock label="Sources" active={active}>
      <RadioGroup
        value={filters.citations}
        onValueChange={(v) => update({ citations: v as typeof TREE_CITATIONS_VALUES[number] })}
        className="space-y-1.5"
        aria-label="Source citation count"
      >
        {TREE_CITATIONS_VALUES.map((v) => {
          const id = `tree-citations-${v}`;
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
