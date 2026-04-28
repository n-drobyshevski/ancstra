'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  type CSSProperties,
} from 'react';
import {
  flexRender,
  getCoreRowModel,
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
import { TooltipProvider } from '@/components/ui/tooltip';
import type { PersonListItem } from '@ancstra/shared';
import {
  treeTableColumns,
  getAriaSort,
  TREE_COLUMN_ID_TO_SORT_KEY,
  TREE_SORT_KEY_TO_COLUMN_ID,
  type TreePersonRow,
} from './tree-table-columns';
import { sexTokens, getInitials } from './detail-sections';
import { Network, ShieldAlert, ShieldCheck, Sprout } from 'lucide-react';
import type {
  TreeDensity,
  TreeSortKey,
  TreeSortDir,
  TreeHidableColumn,
} from '@/lib/tree/search-params';
import type { TreeTableRelationships } from '@/lib/persons/query-tree-table-rows';
import { personDetailCache } from '@/lib/tree/person-detail-cache';

const TT_ROW_HEIGHT_PX: Record<TreeDensity, number> = {
  compact: 32,
  comfortable: 44,
  spacious: 56,
};

interface TreeTableProps {
  rows: TreePersonRow[];
  total: number;
  relationships: TreeTableRelationships;
  onSelectPerson: (personId: string) => void;
  onSetTopologyAnchor?: (person: PersonListItem) => void;
  onSeeOnTree: (personId: string) => void;
  sort?: TreeSortKey;
  dir?: TreeSortDir;
  onSortChange?: (sort: TreeSortKey, dir: TreeSortDir) => void;
  density?: TreeDensity;
  hiddenColumns?: readonly TreeHidableColumn[];
  onClearFilters?: () => void;
  isFiltered?: boolean;
  selectedPersonId?: string | null;
  /** Called when the virtualizer scrolls near the end so the parent can fetch the next page. */
  onLoadMore?: () => void;
  hasMore?: boolean;
  isAppending?: boolean;
}

export function TreeTable({
  rows,
  total,
  relationships,
  onSelectPerson,
  onSetTopologyAnchor,
  onSeeOnTree,
  sort = 'name',
  dir = 'asc',
  onSortChange,
  density = 'comfortable',
  hiddenColumns,
  onClearFilters,
  isFiltered = false,
  selectedPersonId,
  onLoadMore,
  hasMore = false,
  isAppending = false,
}: TreeTableProps) {
  // Sorting state mirrors URL props; sort happens server-side.
  const sorting: SortingState = useMemo(() => {
    const id = TREE_SORT_KEY_TO_COLUMN_ID[sort] ?? 'name';
    return [{ id, desc: dir === 'desc' }];
  }, [sort, dir]);

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
    manualSorting: true,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
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
      onSeeOnTree,
      selectedPersonId,
      isAnchorMode: false,
      relationships,
    },
  });

  const tableRows = table.getRowModel().rows;
  const filteredCount = rows.length;

  // Virtualization (desktop).
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const desktopVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => desktopScrollRef.current,
    estimateSize: () => TT_ROW_HEIGHT_PX[density],
    overscan: 8,
  });

  // Virtualization (mobile).
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const mobileVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => mobileScrollRef.current,
    estimateSize: () => 64,
    overscan: 6,
  });

  // Reset scroll on sort change (filter changes are handled by the parent
  // resetting the rows array, which changes count and naturally resets).
  useEffect(() => {
    desktopVirtualizer.scrollToIndex(0);
    mobileVirtualizer.scrollToIndex(0);
  }, [sort, dir, desktopVirtualizer, mobileVirtualizer]);

  // Re-measure when density changes.
  useEffect(() => {
    desktopVirtualizer.measure();
  }, [density, desktopVirtualizer]);

  // Infinite-scroll trigger — fire onLoadMore as the user nears the end of
  // the current rows. We only trigger when there is more to load and we
  // aren't already appending.
  useEffect(() => {
    if (!onLoadMore || !hasMore || isAppending) return;
    const items = desktopVirtualizer.getVirtualItems();
    if (items.length === 0) return;
    const lastVisible = items[items.length - 1].index;
    if (lastVisible >= tableRows.length - 10) {
      onLoadMore();
    }
  }, [
    desktopVirtualizer,
    desktopVirtualizer.getVirtualItems(),
    hasMore,
    isAppending,
    onLoadMore,
    tableRows.length,
  ]);

  useEffect(() => {
    if (!onLoadMore || !hasMore || isAppending) return;
    const items = mobileVirtualizer.getVirtualItems();
    if (items.length === 0) return;
    const lastVisible = items[items.length - 1].index;
    if (lastVisible >= tableRows.length - 10) {
      onLoadMore();
    }
  }, [
    mobileVirtualizer,
    mobileVirtualizer.getVirtualItems(),
    hasMore,
    isAppending,
    onLoadMore,
    tableRows.length,
  ]);

  // Keyboard navigation.
  const [focusedIndex, setFocusedIndex] = useState(0);
  useEffect(() => {
    setFocusedIndex(0);
  }, [tableRows.length, sort, dir]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
      if (tableRows.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(focusedIndex + 1, tableRows.length - 1);
        setFocusedIndex(next);
        desktopVirtualizer.scrollToIndex(next, { align: 'auto' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.max(focusedIndex - 1, 0);
        setFocusedIndex(next);
        desktopVirtualizer.scrollToIndex(next, { align: 'auto' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const row = tableRows[focusedIndex];
        if (row) onSelectPerson(row.original.id);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        const row = tableRows[focusedIndex];
        if (row) onSetTopologyAnchor?.(row.original);
      }
    },
    [focusedIndex, tableRows, onSelectPerson, onSetTopologyAnchor, desktopVirtualizer],
  );

  // Empty-tree state when there are zero rows AND no active filter.
  if (total === 0 && !isFiltered) {
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
                {tableRows.length === 0 ? (
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
                      const row = tableRows[vRow.index];
                      if (!row) return null;
                      const p = row.original;
                      const isSelected = selectedPersonId === p.id;
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
                              data-state={isSelected ? 'selected' : undefined}
                              className={
                                'group/row cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-1px] motion-reduce:transition-none ' +
                                (isSelected ? 'bg-muted/60' : '')
                              }
                              onPointerEnter={() => { void personDetailCache.prefetch(p.id); }}
                              onPointerDown={() => { void personDetailCache.prefetch(p.id); }}
                              onFocus={() => { void personDetailCache.prefetch(p.id); }}
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
                            <ContextMenuItem onSelect={() => onSeeOnTree(p.id)}>
                              <Network className="mr-2 size-4" /> View on tree
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
            {tableRows.length === 0 ? (
              <NoResults onClear={onClearFilters} hasFilters={isFiltered} />
            ) : (
              <div style={{ height: mobileVirtualizer.getTotalSize(), position: 'relative' }}>
                {mobileVirtualizer.getVirtualItems().map((vRow) => {
                  const row = tableRows[vRow.index];
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
                        onSelect={() => onSelectPerson(p.id)}
                        onSetAnchor={
                          onSetTopologyAnchor ? () => onSetTopologyAnchor(p) : undefined
                        }
                        onSeeOnTree={() => onSeeOnTree(p.id)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer status */}
        <div
          className="flex items-center justify-between text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <span>
            Showing {filteredCount.toLocaleString()} of {total.toLocaleString()}{' '}
            {total === 1 ? 'person' : 'people'}
            {isAppending ? ' • loading…' : ''}
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
  onSelect: () => void;
  onSetAnchor?: () => void;
  onSeeOnTree: () => void;
}

function MobileTreeRow({
  person,
  isSelected,
  onSelect,
  onSetAnchor,
  onSeeOnTree,
}: MobileTreeRowProps) {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={() => { void personDetailCache.prefetch(person.id); }}
      onFocus={() => { void personDetailCache.prefetch(person.id); }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={
        'flex w-full items-center gap-3 px-4 py-3 text-left border-b border-border transition-colors active:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-1px] cursor-pointer ' +
        (isSelected ? 'bg-muted/60' : 'hover:bg-muted/50')
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSeeOnTree();
        }}
        aria-label={`View ${person.givenName} ${person.surname} on tree`}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Network className="size-4" aria-hidden />
      </button>
    </div>
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
