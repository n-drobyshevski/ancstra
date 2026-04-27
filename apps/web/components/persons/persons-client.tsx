'use client';

import { useState, useEffect } from 'react';
import { useQueryStates, debounce } from 'nuqs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PersonTable } from '@/components/person-table';
import { personsParsers } from '@/lib/persons/search-params';
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

  useEffect(() => {
    setQueryInput(filters.q);
  }, [filters.q]);

  const totalPages = Math.max(1, Math.ceil(initialTotal / filters.size));

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
      <PersonTable persons={initialPersons} />
      {initialTotal > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {filters.page} of {totalPages} ({initialTotal} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() => void setFilters({ page: filters.page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages}
              onClick={() => void setFilters({ page: filters.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
