'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { FacetBlock } from '@/components/persons/facets/facet-block';
import { useTreeTableFilters, useTreeFilterUpdate } from '../use-tree-table-filters';
import { TREE_LIVING_VALUES } from '@/lib/tree/search-params';

// Tree uses 'living'/'deceased' (vs persons' 'alive'/'deceased') — the labels
// match what the rest of the tree UI shows ("Hide living", etc.).
const LIVING_LABELS: Record<typeof TREE_LIVING_VALUES[number], string> = {
  living: 'Living',
  deceased: 'Deceased',
};

export function FacetLiving() {
  const { filters } = useTreeTableFilters();
  const update = useTreeFilterUpdate();
  const active = filters.living.length === 1;

  const toggle = (value: typeof TREE_LIVING_VALUES[number]) => {
    const next = filters.living.includes(value)
      ? filters.living.filter((v) => v !== value)
      : [...filters.living, value];
    // Both selected == no filter; mirror the empty-array convention.
    update({ living: next.length === TREE_LIVING_VALUES.length ? [] : next });
  };

  return (
    <FacetBlock label="Living" defaultOpen active={active}>
      <div className="space-y-1.5">
        {TREE_LIVING_VALUES.map((v) => {
          const id = `tree-living-${v}`;
          const checked = filters.living.length === 0 || filters.living.includes(v);
          return (
            <label key={v} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox id={id} checked={checked} onCheckedChange={() => toggle(v)} />
              <span>{LIVING_LABELS[v]}</span>
            </label>
          );
        })}
      </div>
    </FacetBlock>
  );
}
