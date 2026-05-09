'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { FacetBlock } from '@/components/persons/facets/facet-block';
import { useTreeTableFilters, useTreeFilterUpdate } from '../use-tree-table-filters';

export function FacetHasProposals() {
  const t = useTranslations('persons.facets.hasProposals');
  const { filters } = useTreeTableFilters();
  const update = useTreeFilterUpdate();

  return (
    <FacetBlock label={t('label')} active={filters.hasProposals}>
      <label htmlFor="tree-has-proposals" className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          id="tree-has-proposals"
          checked={filters.hasProposals}
          onCheckedChange={(checked) => update({ hasProposals: Boolean(checked) })}
        />
        <span>{t('description')}</span>
      </label>
    </FacetBlock>
  );
}
