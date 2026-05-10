'use client';

import { debounce } from 'nuqs';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { FacetBlock } from '@/components/persons/facets/facet-block';
import { useTreeTableFilters } from '../use-tree-table-filters';
import { useDerivedState } from '@/hooks/use-derived-state';

export function FacetSearch() {
  const t = useTranslations('persons.facets.search');
  const { filters, setFilters } = useTreeTableFilters();
  const [value, setValue] = useDerivedState(filters.q);

  const active = filters.q.trim() !== '';

  return (
    <FacetBlock label={t('label')} defaultOpen active={active}>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={t('placeholder')}
          aria-label={t('ariaLabel')}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            void setFilters(
              { q: e.target.value, page: 1 },
              { limitUrlUpdates: debounce(500) },
            );
          }}
          className="pl-7 h-8 text-sm"
        />
      </div>
    </FacetBlock>
  );
}
