'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { FacetBlock } from './facet-block';
import { usePersonsFilters, useFilterUpdate } from '../use-persons-filters';
import { SEX_VALUES } from '@/lib/persons/search-params';

const SEX_LABELS: Record<typeof SEX_VALUES[number], string> = {
  M: 'Male', F: 'Female', U: 'Unknown',
};

export function FacetSex() {
  const { filters } = usePersonsFilters();
  const update = useFilterUpdate();
  const active = filters.sex.length > 0 && filters.sex.length < SEX_VALUES.length;

  const toggle = (value: typeof SEX_VALUES[number]) => {
    const next = filters.sex.includes(value)
      ? filters.sex.filter((v) => v !== value)
      : [...filters.sex, value];
    update({ sex: next });
  };

  return (
    <FacetBlock label="Sex" defaultOpen active={active}>
      <div className="space-y-1.5">
        {SEX_VALUES.map((v) => {
          const id = `sex-${v}`;
          return (
            <label key={v} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox id={id} checked={filters.sex.includes(v)} onCheckedChange={() => toggle(v)} />
              <span>{SEX_LABELS[v]}</span>
            </label>
          );
        })}
      </div>
    </FacetBlock>
  );
}
