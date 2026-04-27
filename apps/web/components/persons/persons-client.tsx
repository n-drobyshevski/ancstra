'use client';

import { useState, useEffect } from 'react';
import { useQueryStates, debounce } from 'nuqs';
import { Input } from '@/components/ui/input';
import { personsParsers } from '@/lib/persons/search-params';
import { PersonsDataTable } from './persons-data-table';
import type { PersonListItem } from '@ancstra/shared';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

interface PersonsClientProps {
  initialPersons: PersonListItem[];
  initialTotal: number;
  yearBounds: TreeYearBounds;
}

export function PersonsClient({ initialPersons, initialTotal }: PersonsClientProps) {
  const [filters, setFilters] = useQueryStates(personsParsers, {
    shallow: false,
    history: 'push',
  });

  const [queryInput, setQueryInput] = useState(filters.q);

  // Sync controlled input when browser back/forward changes the URL
  useEffect(() => {
    setQueryInput(filters.q);
  }, [filters.q]);

  return (
    <>
      <Input
        placeholder="Search by name..."
        value={queryInput}
        onChange={(e) => {
          setQueryInput(e.target.value);
          void setFilters(
            { q: e.target.value, page: 1 },
            { limitUrlUpdates: debounce(500) },
          );
        }}
        className="max-w-sm"
      />
      <PersonsDataTable data={initialPersons} total={initialTotal} />
    </>
  );
}
