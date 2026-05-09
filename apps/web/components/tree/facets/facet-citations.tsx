'use client';

import { useTranslations } from 'next-intl';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FacetBlock } from '@/components/persons/facets/facet-block';
import { useTreeTableFilters, useTreeFilterUpdate } from '../use-tree-table-filters';
import { TREE_CITATIONS_VALUES } from '@/lib/tree/search-params';

export function FacetCitations() {
  const t = useTranslations('persons.facets.citations');
  const tValues = useTranslations('persons.facets.citations.values');
  const { filters } = useTreeTableFilters();
  const update = useTreeFilterUpdate();
  const active = filters.citations !== 'any';

  return (
    <FacetBlock label={t('label')} active={active}>
      <RadioGroup
        value={filters.citations}
        onValueChange={(v) => update({ citations: v as typeof TREE_CITATIONS_VALUES[number] })}
        className="space-y-1.5"
        aria-label={t('groupAriaLabel')}
      >
        {TREE_CITATIONS_VALUES.map((v) => {
          const id = `tree-citations-${v}`;
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
