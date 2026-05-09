'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { FacetBlock } from './facet-block';
import { usePersonsFilters, useFilterUpdate } from '../use-persons-filters';

export function FacetHasProposals() {
  const t = useTranslations('persons.facets.hasProposals');
  const { filters } = usePersonsFilters();
  const update = useFilterUpdate();

  return (
    <FacetBlock label={t('label')} active={filters.hasProposals}>
      <label htmlFor="has-proposals" className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          id="has-proposals"
          checked={filters.hasProposals}
          onCheckedChange={(checked) => update({ hasProposals: Boolean(checked) })}
        />
        <span>{t('description')}</span>
      </label>
    </FacetBlock>
  );
}
