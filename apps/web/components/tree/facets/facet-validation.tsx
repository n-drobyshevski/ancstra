'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { FacetBlock } from '@/components/persons/facets/facet-block';
import { useTreeTableFilters, useTreeFilterUpdate } from '../use-tree-table-filters';
import { TREE_VALIDATION_VALUES } from '@/lib/tree/search-params';

const VALIDATION_LABELS: Record<typeof TREE_VALIDATION_VALUES[number], string> = {
  confirmed: 'Confirmed',
  proposed: 'Proposed / disputed',
};

export function FacetValidation() {
  const { filters } = useTreeTableFilters();
  const update = useTreeFilterUpdate();
  const active = filters.validation.length === 1;

  const toggle = (value: typeof TREE_VALIDATION_VALUES[number]) => {
    const next = filters.validation.includes(value)
      ? filters.validation.filter((v) => v !== value)
      : [...filters.validation, value];
    update({ validation: next });
  };

  return (
    <FacetBlock label="Validation" active={active}>
      <div className="space-y-1.5">
        {TREE_VALIDATION_VALUES.map((v) => {
          const id = `tree-validation-${v}`;
          return (
            <label key={v} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox id={id} checked={filters.validation.includes(v)} onCheckedChange={() => toggle(v)} />
              <span>{VALIDATION_LABELS[v]}</span>
            </label>
          );
        })}
      </div>
    </FacetBlock>
  );
}
