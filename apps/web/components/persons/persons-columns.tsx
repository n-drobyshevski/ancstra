'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { ColumnDef, SortDirection } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { PersonListItem } from '@ancstra/shared';
import type { HidableColumn } from '@/lib/persons/search-params';
import { Checkbox } from '@/components/ui/checkbox';
import type { SelectionState } from './use-selection';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unnecessary-type-constraint
  interface TableMeta<TData extends unknown> {
    selection?: SelectionState;
    pageIds?: readonly string[];
    onToggleRow?: (id: string) => void;
    onTogglePage?: (pageIds: readonly string[], allChecked: boolean) => void;
  }
}

const sexLabel = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

function formatRelative(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '—';
  }
}

function SortIndicator({ direction }: { direction: false | SortDirection }) {
  if (direction === 'asc') return <ArrowUp className="ml-1 h-3 w-3" aria-hidden />;
  if (direction === 'desc') return <ArrowDown className="ml-1 h-3 w-3" aria-hidden />;
  return null;
}

interface SortableHeaderProps {
  label: string;
  isSorted: false | SortDirection;
  onClick: () => void;
}

function SortableHeader({ label, isSorted, onClick }: SortableHeaderProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="-ml-3 h-8 data-[state=sorted]:font-medium"
      data-state={isSorted ? 'sorted' : undefined}
    >
      {label}
      <SortIndicator direction={isSorted} />
    </Button>
  );
}

export function getAriaSort(direction: false | SortDirection): 'ascending' | 'descending' | 'none' {
  if (direction === 'asc') return 'ascending';
  if (direction === 'desc') return 'descending';
  return 'none';
}

export const personsColumns: ColumnDef<PersonListItem>[] = [
  {
    id: 'select',
    enableSorting: false,
    enableHiding: false,
    size: 32,
    header: ({ table }) => {
      const meta = table.options.meta;
      const selection = meta?.selection;
      const pageIds = meta?.pageIds ?? [];
      if (!selection || !meta?.onTogglePage) return null;

      let checked: boolean | 'indeterminate' = false;
      if (selection.kind === 'matching') {
        const someExcluded = pageIds.some((id) => selection.exclude.has(id));
        const allExcluded = pageIds.length > 0 && pageIds.every((id) => selection.exclude.has(id));
        checked = allExcluded ? false : someExcluded ? 'indeterminate' : true;
      } else if (selection.kind === 'ids') {
        const checkedCount = pageIds.filter((id) => selection.rowIds.has(id)).length;
        checked = checkedCount === 0 ? false : checkedCount === pageIds.length ? true : 'indeterminate';
      }

      return (
        <Checkbox
          checked={checked}
          onCheckedChange={() => {
            const allChecked = checked === true;
            meta.onTogglePage!(pageIds, allChecked);
          }}
          aria-label={checked === true ? 'Deselect all on page' : 'Select all on page'}
        />
      );
    },
    cell: ({ row, table }) => {
      const meta = table.options.meta;
      const selection = meta?.selection;
      if (!selection || !meta?.onToggleRow) return null;

      const id = row.original.id;
      const isChecked =
        selection.kind === 'matching'
          ? !selection.exclude.has(id)
          : selection.kind === 'ids'
            ? selection.rowIds.has(id)
            : false;

      return (
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => meta.onToggleRow!(id)}
          aria-label={isChecked ? `Deselect ${row.original.givenName} ${row.original.surname}` : `Select ${row.original.givenName} ${row.original.surname}`}
        />
      );
    },
  },
  {
    id: 'name',
    accessorFn: (row) => `${row.surname} ${row.givenName}`,
    header: ({ column }) => (
      <SortableHeader
        label="Name"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => (
      <Link
        href={`/persons/${row.original.id}`}
        className="font-medium text-primary underline-offset-4 hover:underline"
        style={{ viewTransitionName: `person-${row.original.id}` }}
      >
        {row.original.givenName} {row.original.surname}
      </Link>
    ),
    enableHiding: false,
    enableSorting: true,
  },
  {
    id: 'sex',
    accessorKey: 'sex',
    header: 'Sex',
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs">
        {sexLabel[row.original.sex]}
      </Badge>
    ),
    enableSorting: false,
    size: 64,
  },
  {
    id: 'born',
    accessorKey: 'birthDate',
    header: ({ column }) => (
      <SortableHeader
        label="Birth"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {row.original.birthDate ?? '—'}
      </span>
    ),
    enableSorting: true,
    size: 96,
  },
  {
    id: 'died',
    accessorKey: 'deathDate',
    header: ({ column }) => (
      <SortableHeader
        label="Death"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {row.original.deathDate ?? '—'}
      </span>
    ),
    enableSorting: true,
    size: 96,
  },
  {
    id: 'completeness',
    accessorKey: 'completeness',
    header: ({ column }) => (
      <SortableHeader
        label="Completeness"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => {
      const value = row.original.completeness ?? 0;
      return (
        <div className="flex items-center gap-2">
          <Progress value={value} className="h-2 w-20" aria-label={`${value}% complete`} />
          <span className="text-xs text-muted-foreground tabular-nums">{value}%</span>
        </div>
      );
    },
    enableSorting: true,
    size: 128,
  },
  {
    id: 'sourcesCount',
    accessorKey: 'sourcesCount',
    header: ({ column }) => (
      <div className="text-right">
        <SortableHeader
          label="Sources"
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums text-muted-foreground">
        {row.original.sourcesCount ?? 0}
      </div>
    ),
    enableSorting: true,
    size: 80,
  },
  {
    id: 'validation',
    accessorKey: 'validation',
    header: 'Validation',
    cell: ({ row }) => {
      const v = row.original.validation ?? 'confirmed';
      return v === 'proposed' ? (
        <Badge
          variant="outline"
          className="border-status-warning-text bg-status-warning-bg text-status-warning-text"
        >
          Proposed
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">Confirmed</span>
      );
    },
    enableSorting: false,
    size: 96,
  },
  {
    id: 'updatedAt',
    accessorKey: 'updatedAt',
    header: ({ column }) => (
      <SortableHeader
        label="Last edited"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {formatRelative(row.original.updatedAt)}
      </span>
    ),
    enableSorting: true,
    size: 128,
  },
];

export const SORT_KEY_TO_COLUMN_ID: Record<string, string> = {
  name: 'name', born: 'born', died: 'died',
  compl: 'completeness', sources: 'sourcesCount', edited: 'updatedAt',
};
export const COLUMN_ID_TO_SORT_KEY: Record<string, string> = {
  name: 'name', born: 'born', died: 'died',
  completeness: 'compl', sourcesCount: 'sources', updatedAt: 'edited',
};

export const HIDABLE_COLUMN_IDS: readonly HidableColumn[] = [
  'sex', 'birthDate', 'deathDate', 'completeness', 'sourcesCount', 'validation', 'updatedAt',
];

export const COLUMN_ID_TO_HIDE_KEY: Record<string, HidableColumn> = {
  sex: 'sex', born: 'birthDate', died: 'deathDate',
  completeness: 'completeness', sourcesCount: 'sourcesCount',
  validation: 'validation', updatedAt: 'updatedAt',
};
export const HIDE_KEY_TO_COLUMN_ID: Record<HidableColumn, string> = {
  sex: 'sex', birthDate: 'born', deathDate: 'died',
  completeness: 'completeness', sourcesCount: 'sourcesCount',
  validation: 'validation', updatedAt: 'updatedAt',
};
