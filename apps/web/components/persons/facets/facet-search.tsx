'use client';

import { useState, useEffect } from 'react';
import { debounce } from 'nuqs';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FacetBlock } from './facet-block';
import { usePersonsFilters } from '../use-persons-filters';

export function FacetSearch() {
  const { filters, setFilters } = usePersonsFilters();
  const [value, setValue] = useState(filters.q);

  useEffect(() => {
    setValue(filters.q);
  }, [filters.q]);

  const active = filters.q.trim() !== '';

  return (
    <FacetBlock label="Search" defaultOpen active={active}>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          placeholder="Name, place, notes..."
          aria-label="Search persons"
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
