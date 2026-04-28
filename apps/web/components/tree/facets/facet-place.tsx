'use client';

import { useState, useEffect } from 'react';
import { debounce } from 'nuqs';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FacetBlock } from '@/components/persons/facets/facet-block';
import { useTreeTableFilters } from '../use-tree-table-filters';
import { TREE_PLACE_SCOPES } from '@/lib/tree/search-params';

const SCOPE_LABEL: Record<typeof TREE_PLACE_SCOPES[number], string> = {
  birth: 'Birth only',
  any: 'Any event',
};

export function FacetPlace() {
  const { filters, setFilters } = useTreeTableFilters();
  const [text, setText] = useState(filters.place);

  useEffect(() => { setText(filters.place); }, [filters.place]);

  const active = filters.place.trim() !== '';

  return (
    <FacetBlock label="Place" active={active}>
      <Input
        type="search"
        aria-label="Place contains"
        placeholder="e.g. Chicago"
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
          void setFilters({ placeScope: v as typeof TREE_PLACE_SCOPES[number], page: 1 })
        }
        className="mt-2 space-y-1.5"
        aria-label="Place scope"
      >
        {TREE_PLACE_SCOPES.map((v) => {
          const id = `tree-placescope-${v}`;
          return (
            <label key={v} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem id={id} value={v} />
              <span>{SCOPE_LABEL[v]}</span>
            </label>
          );
        })}
      </RadioGroup>
    </FacetBlock>
  );
}
