'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { FacetBlock } from '@/components/persons/facets/facet-block';
import { useTreeTableFilters, useTreeFilterUpdate } from '../use-tree-table-filters';

export function FacetHasProposals() {
  const { filters } = useTreeTableFilters();
  const update = useTreeFilterUpdate();

  return (
    <FacetBlock label="AI proposals" active={filters.hasProposals}>
      <label htmlFor="tree-has-proposals" className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          id="tree-has-proposals"
          checked={filters.hasProposals}
          onCheckedChange={(checked) => update({ hasProposals: Boolean(checked) })}
        />
        <span>Only people with open AI proposals</span>
      </label>
    </FacetBlock>
  );
}
