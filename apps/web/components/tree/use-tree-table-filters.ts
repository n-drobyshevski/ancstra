'use client';

import { useTransition, useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import {
  treeTableParsers,
  type TreeTableFilters,
} from '@/lib/tree/search-params';

/**
 * Tree-table filter hook — mirrors usePersonsFilters but bound to the tree's
 * URL parser. shallow=false because the server reads filters to refetch the
 * page; history='push' so back/forward navigates between filter states.
 */
export function useTreeTableFilters() {
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(treeTableParsers, {
    shallow: false,
    history: 'push',
    startTransition,
  });
  return { filters, setFilters, isPending };
}

/** Helper that resets page=1 alongside any filter change. */
export function useTreeFilterUpdate() {
  const { setFilters } = useTreeTableFilters();
  return useCallback(
    (patch: Partial<TreeTableFilters>) => {
      void setFilters({ ...patch, page: 1 });
    },
    [setFilters],
  );
}
