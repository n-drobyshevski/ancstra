'use client';

import { debounce } from 'nuqs';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FacetBlock } from './facet-block';
import { usePersonsFilters } from '../use-persons-filters';
import { PLACE_SCOPE_VALUES } from '@/lib/persons/search-params';
import { useDerivedState } from '@/hooks/use-derived-state';

export function FacetPlace() {
  const t = useTranslations('persons.facets.place');
  const tScopes = useTranslations('persons.facets.place.scopes');
  const { filters, setFilters } = usePersonsFilters();
  const [text, setText] = useDerivedState(filters.place);

  const active = filters.place.trim() !== '';

  return (
    <FacetBlock label={t('label')} active={active}>
      <Input
        type="search"
        aria-label={t('containsAriaLabel')}
        placeholder={t('placeholder')}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          void setFilters(
            { place: e.target.value, page: 1 },
            { limitUrlUpdates: debounce(500) },
          );
        }}
        className="h-8 text-sm"
      />
      <RadioGroup
        value={filters.placeScope}
        onValueChange={(v) =>
          void setFilters({ placeScope: v as typeof PLACE_SCOPE_VALUES[number], page: 1 })
        }
        className="mt-2 space-y-1.5"
        aria-label={t('scopeAriaLabel')}
      >
        {PLACE_SCOPE_VALUES.map((v) => {
          const id = `placescope-${v}`;
          return (
            <label key={v} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem id={id} value={v} />
              <span>{tScopes(v)}</span>
            </label>
          );
        })}
      </RadioGroup>
    </FacetBlock>
  );
}
