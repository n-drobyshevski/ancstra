'use client';

import { ArrowDown, ArrowUp, ShieldAlert, ShieldCheck, Sprout } from 'lucide-react';
import type { ColumnDef, SortDirection } from '@tanstack/react-table';
import type { PersonListItem } from '@ancstra/shared';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sexTokens, getInitials } from './detail-sections';

/** Row shape passed to TanStack — PersonListItem + precomputed childCount. */
export interface TreePersonRow extends PersonListItem {
  childCount: number;
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unnecessary-type-constraint
  interface TableMeta<TData extends unknown> {
    onSelectPerson?: (personId: string) => void;
    onSelectRelative?: (personId: string) => void;
    onSetTopologyAnchor?: (person: PersonListItem) => void;
    selectedPersonId?: string | null;
    isAnchorMode?: boolean;
    relationships?: {
      parents: Record<string, { id: string; name: string }[]>;
      spouses: Record<string, { id: string; name: string }[]>;
    };
  }
}

/** Compact lifespan string: "1842 – 1917" / "b. 1842" / "d. 1917" / "—". */
function compactLifespan(birthDate?: string | null, deathDate?: string | null, isLiving?: boolean): string {
  const by = birthDate?.match(/\b(\d{4})\b/)?.[1];
  const dy = deathDate?.match(/\b(\d{4})\b/)?.[1];
  if (by && dy) return `${by} \u2013 ${dy}`;
  if (by && isLiving) return `${by} \u2013 Living`;
  if (by) return `b. ${by}`;
  if (dy) return `d. ${dy}`;
  return '\u2014';
}

/** Year accessor for sorting; undefined sorts last. */
function birthYearAccessor(p: TreePersonRow): number | undefined {
  const m = p.birthDate?.match(/\b(\d{4})\b/);
  return m ? parseInt(m[1], 10) : undefined;
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

export function SortableHeader({ label, isSorted, onClick }: SortableHeaderProps) {
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

export const treeTableColumns: ColumnDef<TreePersonRow>[] = [
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
    cell: ({ row }) => {
      const p = row.original;
      const tokens = sexTokens[p.sex];
      return (
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="size-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold"
            style={{ backgroundColor: tokens.bg, color: tokens.text }}
            aria-hidden
          >
            {getInitials(p.givenName, p.surname)}
          </div>
          <span className="font-medium truncate">
            {p.givenName} {p.surname}
          </span>
        </div>
      );
    },
    enableSorting: true,
    size: 240,
  },
  {
    id: 'lifespan',
    accessorFn: birthYearAccessor,
    header: ({ column }) => (
      <SortableHeader
        label="Lifespan"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => {
      const p = row.original;
      return (
        <span className="text-muted-foreground tabular-nums text-xs">
          {compactLifespan(p.birthDate, p.deathDate, p.isLiving)}
        </span>
      );
    },
    sortUndefined: 'last',
    enableSorting: true,
    size: 140,
  },
  {
    id: 'sex',
    accessorKey: 'sex',
    header: ({ column }) => (
      <SortableHeader
        label="Sex"
        isSorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      />
    ),
    cell: ({ row }) => {
      const p = row.original;
      const colorVar =
        p.sex === 'M' ? 'var(--sex-male)' : p.sex === 'F' ? 'var(--sex-female)' : 'var(--sex-unknown)';
      const label = p.sex === 'M' ? 'Male' : p.sex === 'F' ? 'Female' : 'Unknown';
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: colorVar }}
              aria-label={label}
            />
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      );
    },
    enableSorting: true,
    size: 56,
  },
  {
    id: 'status',
    enableSorting: false,
    size: 64,
    header: () => (
      <span className="sr-only">Status</span>
    ),
    cell: ({ row }) => {
      const p = row.original;
      return (
        <div className="flex items-center gap-1">
          {p.validation === 'proposed' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <ShieldAlert
                  className="size-3.5"
                  style={{ color: 'var(--status-proposed)' }}
                  aria-label="Proposed"
                />
              </TooltipTrigger>
              <TooltipContent>Proposed — needs review</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <ShieldCheck
                  className="size-3.5"
                  style={{ color: 'var(--status-confirmed)' }}
                  aria-label="Confirmed"
                />
              </TooltipTrigger>
              <TooltipContent>Confirmed</TooltipContent>
            </Tooltip>
          )}
          {p.isLiving && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Sprout
                  className="size-3.5"
                  style={{ color: 'var(--status-confirmed)' }}
                  aria-label="Living"
                />
              </TooltipTrigger>
              <TooltipContent>Presumed living</TooltipContent>
            </Tooltip>
          )}
        </div>
      );
    },
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
    id: 'parents',
    enableSorting: false,
    size: 160,
    header: () => 'Parents',
    cell: ({ row, table }) => {
      const list = table.options.meta?.relationships?.parents[row.original.id] ?? [];
      const onPick = table.options.meta?.onSelectRelative;
      if (list.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="truncate inline-block max-w-[160px]">
          {list.map((p, i) => (
            <span key={p.id}>
              {i > 0 && <span className="text-muted-foreground">, </span>}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onPick?.(p.id);
                }}
              >
                {p.name}
              </button>
            </span>
          ))}
        </span>
      );
    },
  },
  {
    id: 'spouses',
    enableSorting: false,
    size: 160,
    header: () => 'Spouses',
    cell: ({ row, table }) => {
      const list = table.options.meta?.relationships?.spouses[row.original.id] ?? [];
      const onPick = table.options.meta?.onSelectRelative;
      if (list.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="truncate inline-block max-w-[160px]">
          {list.map((s, i) => (
            <span key={s.id}>
              {i > 0 && <span className="text-muted-foreground">, </span>}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onPick?.(s.id);
                }}
              >
                {s.name}
              </button>
            </span>
          ))}
        </span>
      );
    },
  },
  {
    id: 'children',
    accessorKey: 'childCount',
    header: ({ column }) => (
      <div className="text-right">
        <SortableHeader
          label="Children"
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{row.original.childCount}</div>
    ),
    enableSorting: true,
    size: 80,
  },
];

export const TREE_SORT_KEY_TO_COLUMN_ID: Record<string, string> = {
  name: 'name',
  lifespan: 'lifespan',
  sex: 'sex',
  children: 'children',
};

export const TREE_COLUMN_ID_TO_SORT_KEY: Record<string, 'name' | 'lifespan' | 'sex' | 'children'> = {
  name: 'name',
  lifespan: 'lifespan',
  sex: 'sex',
  children: 'children',
};
