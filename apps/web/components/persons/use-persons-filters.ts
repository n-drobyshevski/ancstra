'use client';

import { useTransition, useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { personsParsers, type PersonsFilters } from '@/lib/persons/search-params';

export function usePersonsFilters() {
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(personsParsers, {
    shallow: false,
    history: 'push',
    startTransition,
  });
  return { filters, setFilters, isPending };
}

/** Helper that resets page=1 alongside any filter change. */
export function useFilterUpdate() {
  const { setFilters } = usePersonsFilters();
  return useCallback(
    (patch: Partial<PersonsFilters>) => {
      void setFilters({ ...patch, page: 1 });
    },
    [setFilters],
  );
}
