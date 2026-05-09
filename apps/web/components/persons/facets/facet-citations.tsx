'use client';

import { useTranslations } from 'next-intl';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FacetBlock } from './facet-block';
import { usePersonsFilters, useFilterUpdate } from '../use-persons-filters';
import { CITATIONS_VALUES } from '@/lib/persons/search-params';

export function FacetCitations() {
  const t = useTranslations('persons.facets.citations');
  const tValues = useTranslations('persons.facets.citations.values');
  const { filters } = usePersonsFilters();
  const update = useFilterUpdate();
  const active = filters.citations !== 'any';

  return (
    <FacetBlock label={t('label')} active={active}>
      <RadioGroup
        value={filters.citations}
        onValueChange={(v) => update({ citations: v as typeof CITATIONS_VALUES[number] })}
        className="space-y-1.5"
        aria-label={t('groupAriaLabel')}
      >
        {CITATIONS_VALUES.map((v) => {
          const id = `citations-${v}`;
          return (
            <label key={v} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem id={id} value={v} />
              <span>{tValues(v)}</span>
            </label>
          );
        })}
      </RadioGroup>
    </FacetBlock>
  );
}
