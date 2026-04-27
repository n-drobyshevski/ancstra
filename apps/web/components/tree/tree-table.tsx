'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { TreeData, PersonListItem } from '@ancstra/shared';
import type { FilterState } from './tree-utils';
import {
  treeTableColumns,
  getAriaSort,
  TREE_COLUMN_ID_TO_SORT_KEY,
  TREE_SORT_KEY_TO_COLUMN_ID,
  type TreePersonRow,
} from './tree-table-columns';
import { sexTokens, getInitials } from './detail-sections';
import { ShieldAlert, ShieldCheck, Sprout } from 'lucide-react';
import type {
  TreeDensity,
  TreeSortKey,
  TreeSortDir,
  TreeHidableColumn,
} from '@/lib/tree/search-params';

const TT_ROW_HEIGHT_PX: Record<TreeDensity, number> = {
  compact: 32,
  comfortable: 44,
  spacious: 56,
};

interface TreeTableProps {
  treeData: TreeData;
  relationships: {
    parents: Record<string, { id: string; name: string }[]>;
    spouses: Record<string, { id: string; name: string }[]>;
  };
  onSelectPerson: (personId: string) => void;
  onSetTopologyAnchor?: (person: PersonListItem) => void;
  filterState?: FilterState;
  topologyVisibleIds?: Set<string> | null;
  search?: string;
  sort?: TreeSortKey;
  dir?: TreeSortDir;
  onSortChange?: (sort: TreeSortKey, dir: TreeSortDir) => void;
  density?: TreeDensity;
  hiddenColumns?: readonly TreeHidableColumn[];
  onClearFilters?: () => void;
  topologyMode?: 'all' | 'ancestors' | 'descendants';
  selectedPersonId?: string | null;
  isLoading?: boolean;
}

export function TreeTable({
  treeData,
  relationships,
  onSelectPerson,
  onSetTopologyAnchor,
  filterState,
  topologyVisibleIds,
  search = '',
  sort = 'name',
  dir = 'asc',
  onSortChange,
  density = 'comfortable',
  hiddenColumns,
  onClearFilters,
  topologyMode = 'all',
  selectedPersonId,
  isLoading = false,
}: TreeTableProps) {
  // Pre-compute child count map once per treeData (eliminates O(n²) sort).
  const childCountMap = useMemo(() => {
    const map = new Map<string, number>();
    const familyToParents = new Map<string, string[]>();
    for (const f of treeData.families) {
      const parents: string[] = [];
      if (f.partner1Id) parents.push(f.partner1Id);
      if (f.partner2Id) parents.push(f.partner2Id);
      familyToParents.set(f.id, parents);
    }
    for (const cl of treeData.childLinks) {
      const parents = familyToParents.get(cl.familyId) ?? [];
      for (const pid of parents) {
        map.set(pid, (map.get(pid) ?? 0) + 1);
      }
    }
    return map;
  }, [treeData.families, treeData.childLinks]);

  // Enrich + filter rows.
  const rows = useMemo<TreePersonRow[]>(() => {
    let result: PersonListItem[] = treeData.persons;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.givenName.toLowerCase().includes(q) ||
          p.surname.toLowerCase().includes(q),
      );
    }

    if (filterState) {
      result = result.filter((p) => {
        const sexVisible = filterState.sex[p.sex as 'M' | 'F' | 'U'] ?? true;
        const livingVisible = p.isLiving
          ? filterState.living.living
          : filterState.living.deceased;
        return sexVisible && livingVisible;
      });
    }

    if (topologyVisibleIds) {
      result = result.filter((p) => topologyVisibleIds.has(p.id));
    }

    return result.map((p) => ({
      ...p,
      childCount: childCountMap.get(p.id) ?? 0,
    }));
  }, [treeData.persons, search, filterState, topologyVisibleIds, childCountMap]);

  // Sorting state synced with parent props.
  const sorting: SortingState = useMemo(() => {
    const id = TREE_SORT_KEY_TO_COLUMN_ID[sort] ?? 'name';
    return [{ id, desc: dir === 'desc' }];
  }, [sort, dir]);

  // Column visibility from URL `hide` param.
  const columnVisibility: VisibilityState = useMemo(() => {
    const v: VisibilityState = {};
    if (hiddenColumns) {
      for (const col of hiddenColumns) {
        v[col] = false;
      }
    }
    return v;
  }, [hiddenColumns]);

  const handleSelectRelative = useCallback(
    (personId: string) => onSelectPerson(personId),
    [onSelectPerson],
  );

  const table = useReactTable({
    data: rows,
    columns: treeTableColumns,
    state: { sorting, columnVisibility },
    enableMultiSort: false,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      if (!first) return;
      const sortKey = TREE_COLUMN_ID_TO_SORT_KEY[first.id];
      if (!sortKey) return;
      onSortChange?.(sortKey, first.desc ? 'desc' : 'asc');
    },
    onColumnVisibilityChange: () => {
      // Driven by TreeColumnsDropdown writing to URL; no-op here.
    },
    meta: {
      onSelectPerson,
      onSelectRelative: handleSelectRelative,
      onSetTopologyAnchor,
      selectedPersonId,
      isAnchorMode: topologyMode !== 'all',
      relationships,
    },
  });

  const sortedRows = table.getRowModel().rows;
  const totalCount = treeData.persons.length;
  const filteredCount = sortedRows.length;
  const isFiltered =
    !!search ||
    !!topologyVisibleIds ||
    (filterState
      ? !filterState.sex.M ||
        !filterState.sex.F ||
        !filterState.sex.U ||
        !filterState.living.living ||
        !filterState.living.deceased
      : false);

  // Virtualization (desktop).
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const desktopVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => desktopScrollRef.current,
    estimateSize: () => TT_ROW_HEIGHT_PX[density],
    overscan: 8,
  });

  // Virtualization (mobile).
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const mobileVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => mobileScrollRef.current,
    estimateSize: () => 64,
    overscan: 6,
  });

  // Reset scroll on filter changes.
  useEffect(() => {
    desktopVirtualizer.scrollToIndex(0);
    mobileVirtualizer.scrollToIndex(0);
  }, [topologyVisibleIds, search, filterState, desktopVirtualizer, mobileVirtualizer]);

  // Re-measure when density changes.
  useEffect(() => {
    desktopVirtualizer.measure();
  }, [density, desktopVirtualizer]);

  // Keyboard navigation.
  const [focusedIndex, setFocusedIndex] = useState(0);
  useEffect(() => {
    setFocusedIndex(0);
  }, [sortedRows.length, sort, dir]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
      if (sortedRows.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(focusedIndex + 1, sortedRows.length - 1);
        setFocusedIndex(next);
        desktopVirtualizer.scrollToIndex(next, { align: 'auto' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.max(focusedIndex - 1, 0);
        setFocusedIndex(next);
        desktopVirtualizer.scrollToIndex(next, { align: 'auto' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const row = sortedRows[focusedIndex];
        if (row) onSelectPerson(row.original.id);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        const row = sortedRows[focusedIndex];
        if (row) onSetTopologyAnchor?.(row.original);
      }
    },
    [focusedIndex, sortedRows, onSelectPerson, onSetTopologyAnchor, desktopVirtualizer],
  );

  // Empty / loading / no-results.
  if (isLoading) {
    return (
      <div className="flex flex-col h-full" aria-busy="true">
        <div className="flex-1 p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">No persons in your tree yet.</p>
          <p className="text-xs text-muted-foreground/70">
            Add your first person from the toolbar to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full min-h-0 gap-3">
        {/* Desktop: card-wrapped virtualized TanStack table */}
        <div className="hidden md:flex md:flex-col flex-1 min-h-0 rounded-md border overflow-hidden">
        <div
          ref={desktopScrollRef}
          data-density={density}
          className="flex-1 overflow-auto relative"
        >
          <Table className="border-separate border-spacing-0 [&_th:first-child]:pl-4 [&_td:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td:last-child]:pr-4">
            <TableHeader className="sticky top-0 bg-background z-20 shadow-[0_1px_0_var(--border)]">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      aria-sort={getAriaSort(header.column.getIsSorted())}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody onKeyDown={handleKeyDown}>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={treeTableColumns.length} className="h-32">
                    <NoResults onClear={onClearFilters} hasFilters={isFiltered} />
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {desktopVirtualizer.getVirtualItems().length > 0 && (
                    <tr
                      aria-hidden
                      style={{ height: desktopVirtualizer.getVirtualItems()[0].start }}
                    />
                  )}
                  {desktopVirtualizer.getVirtualItems().map((vRow) => {
                    const row = sortedRows[vRow.index];
                    if (!row) return null;
                    const p = row.original;
                    const isSelected = selectedPersonId === p.id;
                    const isAnchor = isSelected && topologyMode !== 'all';
                    return (
                      <ContextMenu key={row.id}>
                        <ContextMenuTrigger asChild>
                          <TableRow
                            ref={(el) => {
                              if (el && vRow.index === focusedIndex) {
                                el.focus({ preventScroll: true });
                              }
                            }}
                            tabIndex={vRow.index === focusedIndex ? 0 : -1}
                            data-state={
                              isAnchor ? 'anchor' : isSelected ? 'selected' : undefined
                            }
                            className={
                              'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-1px] motion-reduce:transition-none ' +
                              (isAnchor
                                ? 'bg-accent/40 outline outline-2 outline-primary outline-offset-[-1px]'
                                : isSelected
                                  ? 'bg-muted/60'
                                  : '')
                            }
                            onClick={() => {
                              setFocusedIndex(vRow.index);
                              onSelectPerson(p.id);
                            }}
                            onDoubleClick={() => onSetTopologyAnchor?.(p)}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell
                                key={cell.id}
                                style={{ width: cell.column.getSize() } as CSSProperties}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem onSelect={() => onSelectPerson(p.id)}>
                            Open detail
                          </ContextMenuItem>
                          {onSetTopologyAnchor && (
                            <ContextMenuItem onSelect={() => onSetTopologyAnchor(p)}>
                              Set as topology anchor
                            </ContextMenuItem>
                          )}
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onSelect={() => {
                              void navigator.clipboard?.writeText(`${p.givenName} ${p.surname}`);
                            }}
                          >
                            Copy name
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                  {desktopVirtualizer.getVirtualItems().length > 0 && (
                    <tr
                      aria-hidden
                      style={{
                        height:
                          desktopVirtualizer.getTotalSize() -
                          (desktopVirtualizer.getVirtualItems().at(-1)?.end ?? 0),
                      }}
                    />
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
        </div>

        {/* Mobile: card-wrapped virtualized cards */}
        <div className="md:hidden flex-1 min-h-0 rounded-md border overflow-hidden">
          <div
            ref={mobileScrollRef}
            data-density={density}
            className="h-full overflow-auto"
            role="list"
            aria-label="People in your family tree"
          >
            {sortedRows.length === 0 ? (
              <NoResults onClear={onClearFilters} hasFilters={isFiltered} />
            ) : (
              <div style={{ height: mobileVirtualizer.getTotalSize(), position: 'relative' }}>
                {mobileVirtualizer.getVirtualItems().map((vRow) => {
                  const row = sortedRows[vRow.index];
                  if (!row) return null;
                  const p = row.original;
                  return (
                    <div
                      key={row.id}
                      role="listitem"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${vRow.start}px)`,
                      }}
                    >
                      <MobileTreeRow
                        person={p}
                        isSelected={selectedPersonId === p.id}
                        isAnchor={selectedPersonId === p.id && topologyMode !== 'all'}
                        onSelect={() => onSelectPerson(p.id)}
                        onSetAnchor={
                          onSetTopologyAnchor ? () => onSetTopologyAnchor(p) : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer status — matches persons-data-table */}
        <div
          className="flex items-center justify-between text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <span>
            Showing {filteredCount.toLocaleString()} of {totalCount.toLocaleString()}{' '}
            {totalCount === 1 ? 'person' : 'people'}
          </span>
          {isFiltered && onClearFilters && (
            <Button variant="link" size="sm" className="h-6 px-2 text-xs" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ─────────────────────────────────────────────────────── */

function NoResults({
  onClear,
  hasFilters,
}: {
  onClear?: () => void;
  hasFilters: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-sm text-muted-foreground">
        {hasFilters
          ? 'No persons match the active filters.'
          : 'No persons match your search.'}
      </p>
      {hasFilters && onClear && (
        <Button variant="link" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

interface MobileTreeRowProps {
  person: PersonListItem;
  isSelected: boolean;
  isAnchor: boolean;
  onSelect: () => void;
  onSetAnchor?: () => void;
}

function MobileTreeRow({ person, isSelected, isAnchor, onSelect, onSetAnchor }: MobileTreeRowProps) {
  const tokens = sexTokens[person.sex];
  const lastTapRef = useRef<number>(0);

  const handleClick = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300 && onSetAnchor) {
      onSetAnchor();
    } else {
      onSelect();
    }
    lastTapRef.current = now;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        'flex w-full items-center gap-3 px-4 py-3 text-left border-b border-border transition-colors active:bg-muted ' +
        (isAnchor
          ? 'bg-accent/40 outline outline-2 outline-primary outline-offset-[-1px]'
          : isSelected
            ? 'bg-muted/60'
            : 'hover:bg-muted/50')
      }
      aria-label={`${person.givenName} ${person.surname}`}
      aria-current={isSelected ? 'true' : undefined}
    >
      <div
        className="size-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold"
        style={{ backgroundColor: tokens.bg, color: tokens.text }}
        aria-hidden
      >
        {getInitials(person.givenName, person.surname)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {person.givenName} {person.surname}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          <span>{compactLifespanInline(person.birthDate, person.deathDate, person.isLiving)}</span>
          {person.isLiving && (
            <Sprout className="size-3" style={{ color: 'var(--status-confirmed)' }} aria-hidden />
          )}
          {person.validation === 'proposed' && (
            <ShieldAlert className="size-3" style={{ color: 'var(--status-proposed)' }} aria-hidden />
          )}
          {person.validation !== 'proposed' && (
            <ShieldCheck className="size-3 opacity-60" style={{ color: 'var(--status-confirmed)' }} aria-hidden />
          )}
        </div>
      </div>
    </button>
  );
}

function compactLifespanInline(
  birthDate?: string | null,
  deathDate?: string | null,
  isLiving?: boolean,
): string {
  const by = birthDate?.match(/\b(\d{4})\b/)?.[1];
  const dy = deathDate?.match(/\b(\d{4})\b/)?.[1];
  if (by && dy) return `${by} \u2013 ${dy}`;
  if (by && isLiving) return `${by} \u2013 Living`;
  if (by) return `b. ${by}`;
  if (dy) return `d. ${dy}`;
  return '\u2014';
}
