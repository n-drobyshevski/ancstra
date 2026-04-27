'use client';

import { useMemo, useTransition } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { useQueryStates } from 'nuqs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { personsParsers, type HidableColumn, type PersonsFilters } from '@/lib/persons/search-params';
import {
  personsColumns,
  COLUMN_ID_TO_SORT_KEY,
  SORT_KEY_TO_COLUMN_ID,
  HIDE_KEY_TO_COLUMN_ID,
} from './persons-columns';
import { ColumnsDropdown } from './columns-dropdown';
import type { PersonListItem } from '@ancstra/shared';

interface PersonsDataTableProps {
  data: PersonListItem[];
  total: number;
}

export function PersonsDataTable({ data, total }: PersonsDataTableProps) {
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(personsParsers, {
    shallow: false,
    history: 'push',
    startTransition,
  });

  const sorting: SortingState = useMemo(
    () => [
      {
        id: SORT_KEY_TO_COLUMN_ID[filters.sort] ?? 'updatedAt',
        desc: filters.dir === 'desc',
      },
    ],
    [filters.sort, filters.dir],
  );

  const columnVisibility: VisibilityState = useMemo(() => {
    const v: VisibilityState = {};
    for (const col of filters.hide) {
      const id = HIDE_KEY_TO_COLUMN_ID[col];
      if (id) v[id] = false;
    }
    return v;
  }, [filters.hide]);

  const pageCount = Math.max(1, Math.ceil(total / filters.size));

  const table = useReactTable({
    data,
    columns: personsColumns,
    state: {
      sorting,
      columnVisibility,
      pagination: { pageIndex: filters.page - 1, pageSize: filters.size },
    },
    pageCount,
    manualPagination: true,
    manualSorting: true,
    enableMultiSort: false,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      if (!first) return;
      const urlKey = COLUMN_ID_TO_SORT_KEY[first.id];
      if (!urlKey) return;
      void setFilters({
        sort: urlKey as PersonsFilters['sort'],
        dir: first.desc ? 'desc' : 'asc',
        page: 1,
      });
    },
    onColumnVisibilityChange: () => {
      // Driven by ColumnsDropdown writing to URL; no-op here.
    },
  });

  const onHideChange = (next: HidableColumn[]) => {
    void setFilters({ hide: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <ColumnsDropdown hidden={filters.hide} onChange={onHideChange} />
      </div>

      <div
        className={`rounded-md border ${isPending ? 'motion-safe:opacity-50 motion-safe:transition-opacity' : ''}`}
        aria-busy={isPending}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={personsColumns.length} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <p>No persons match these filters.</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => void setFilters(defaultClearFilters())}
                    >
                      Clear all filters
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div
        className="flex items-center justify-between text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <span>
          Page {filters.page} of {pageCount} ({total.toLocaleString()} total)
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
            disabled={filters.page >= pageCount}
            onClick={() => void setFilters({ page: filters.page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function defaultClearFilters() {
  return {
    q: '', sex: [], living: [], validation: [],
    bornFrom: null, bornTo: null, diedFrom: null, diedTo: null,
    place: '', placeScope: 'birth' as const,
    citations: 'any' as const, hasProposals: false, complGte: null,
    page: 1,
  };
}
