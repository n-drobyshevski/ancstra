'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { FacetBlock } from './facet-block';
import { usePersonsFilters, useFilterUpdate } from '../use-persons-filters';
import { VALIDATION_VALUES } from '@/lib/persons/search-params';

export function FacetValidation() {
  const t = useTranslations('persons.facets.validation');
  const tValues = useTranslations('persons.facets.validation.values');
  const { filters } = usePersonsFilters();
  const update = useFilterUpdate();
  const active = filters.validation.length === 1;

  const toggle = (value: typeof VALIDATION_VALUES[number]) => {
    const next = filters.validation.includes(value)
      ? filters.validation.filter((v) => v !== value)
      : [...filters.validation, value];
    update({ validation: next });
  };

  return (
    <FacetBlock label={t('label')} defaultOpen active={active}>
      <div className="space-y-1.5">
        {VALIDATION_VALUES.map((v) => {
          const id = `validation-${v}`;
          return (
            <label key={v} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox id={id} checked={filters.validation.includes(v)} onCheckedChange={() => toggle(v)} />
              <span>{tValues(v)}</span>
            </label>
          );
        })}
      </div>
    </FacetBlock>
  );
}
