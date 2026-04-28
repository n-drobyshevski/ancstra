'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { FacetBlock } from '@/components/persons/facets/facet-block';
import { useTreeTableFilters, useTreeFilterUpdate } from '../use-tree-table-filters';
import { TREE_SEX_VALUES } from '@/lib/tree/search-params';

const SEX_LABELS: Record<typeof TREE_SEX_VALUES[number], string> = {
  M: 'Male',
  F: 'Female',
  U: 'Unknown',
};

export function FacetSex() {
  const { filters } = useTreeTableFilters();
  const update = useTreeFilterUpdate();
  const active = filters.sex.length > 0 && filters.sex.length < 3;

  const toggle = (value: typeof TREE_SEX_VALUES[number]) => {
    const next = filters.sex.includes(value)
      ? filters.sex.filter((v) => v !== value)
      : [...filters.sex, value];
    // Clear when all three are selected (== "all", same as empty array).
    update({ sex: next.length === TREE_SEX_VALUES.length ? [] : next });
  };

  return (
    <FacetBlock label="Sex" active={active}>
      <div className="space-y-1.5">
        {TREE_SEX_VALUES.map((v) => {
          const id = `tree-sex-${v}`;
          // Empty array means "all checked" (no filter applied).
          const checked = filters.sex.length === 0 || filters.sex.includes(v);
          return (
            <label key={v} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox id={id} checked={checked} onCheckedChange={() => toggle(v)} />
              <span>{SEX_LABELS[v]}</span>
            </label>
          );
        })}
      </div>
    </FacetBlock>
  );
}
