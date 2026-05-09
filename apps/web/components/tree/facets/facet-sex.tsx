'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { FacetBlock } from '@/components/persons/facets/facet-block';
import { useTreeTableFilters, useTreeFilterUpdate } from '../use-tree-table-filters';
import { TREE_SEX_VALUES } from '@/lib/tree/search-params';

export function FacetSex() {
  const t = useTranslations('persons.facets.sex');
  const tValues = useTranslations('persons.facets.sex.values');
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
    <FacetBlock label={t('label')} active={active}>
      <div className="space-y-1.5">
        {TREE_SEX_VALUES.map((v) => {
          const id = `tree-sex-${v}`;
          // Empty array means "all checked" (no filter applied).
          const checked = filters.sex.length === 0 || filters.sex.includes(v);
          return (
            <label key={v} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox id={id} checked={checked} onCheckedChange={() => toggle(v)} />
              <span>{tValues(v)}</span>
            </label>
          );
        })}
      </div>
    </FacetBlock>
  );
}
