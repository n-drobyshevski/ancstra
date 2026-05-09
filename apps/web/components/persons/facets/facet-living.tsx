'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { FacetBlock } from './facet-block';
import { usePersonsFilters, useFilterUpdate } from '../use-persons-filters';
import { LIVING_VALUES } from '@/lib/persons/search-params';

export function FacetLiving() {
  const t = useTranslations('persons.facets.living');
  const tValues = useTranslations('persons.facets.living.values');
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
    <FacetBlock label={t('label')} defaultOpen active={active}>
      <div className="space-y-1.5">
        {LIVING_VALUES.map((v) => {
          const id = `living-${v}`;
          return (
            <label key={v} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox id={id} checked={filters.living.includes(v)} onCheckedChange={() => toggle(v)} />
              <span>{tValues(v)}</span>
            </label>
          );
        })}
      </div>
    </FacetBlock>
  );
}
