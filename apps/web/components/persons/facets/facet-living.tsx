'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { FacetBlock } from './facet-block';
import { usePersonsFilters, useFilterUpdate } from '../use-persons-filters';
import { LIVING_VALUES } from '@/lib/persons/search-params';

const LIVING_LABELS: Record<typeof LIVING_VALUES[number], string> = {
  alive: 'Alive', deceased: 'Deceased',
};

export function FacetLiving() {
  const { filters } = usePersonsFilters();
  const update = useFilterUpdate();
  const active = filters.living.length === 1;

  const toggle = (value: typeof LIVING_VALUES[number]) => {
    const next = filters.living.includes(value)
      ? filters.living.filter((v) => v !== value)
      : [...filters.living, value];
    update({ living: next });
  };

  return (
    <FacetBlock label="Living" defaultOpen active={active}>
      <div className="space-y-1.5">
        {LIVING_VALUES.map((v) => {
          const id = `living-${v}`;
          return (
            <label key={v} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox id={id} checked={filters.living.includes(v)} onCheckedChange={() => toggle(v)} />
              <span>{LIVING_LABELS[v]}</span>
            </label>
          );
        })}
      </div>
    </FacetBlock>
  );
}
