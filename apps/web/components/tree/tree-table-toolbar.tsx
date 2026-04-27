'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { BarChart3, Rows2, Rows3, Rows4, Search } from 'lucide-react';
import { TreeViewToggle } from './tree-view-toggle';
import type { FilterState } from './tree-utils';
import { TopologyToggle, type TopologyMode } from './topology-toggle';
import { TreeColumnsDropdown } from './tree-columns-dropdown';
import type { TreeDensity, TreeHidableColumn } from '@/lib/tree/search-params';

interface TreeTableToolbarProps {
  view: 'canvas' | 'table';
  onSetView: (v: 'canvas' | 'table') => void;
  filterState: FilterState;
  onToggleFilter: (category: 'sex' | 'living', key: string) => void;
  showGaps: boolean;
  onToggleGaps: () => void;
  topologyMode: TopologyMode;
  onTopologyModeChange: (mode: TopologyMode) => void;
  topologyReferenceName: string | null;
  /** Search query (table view only). */
  search?: string;
  onSearchChange?: (next: string) => void;
  /** Density (table view only). */
  density?: TreeDensity;
  onDensityChange?: (next: TreeDensity) => void;
  /** Column visibility (table view only). */
  hiddenColumns?: readonly TreeHidableColumn[];
  onHiddenColumnsChange?: (next: TreeHidableColumn[]) => void;
}

const DENSITY_OPTIONS: { value: TreeDensity; label: string; icon: typeof Rows2 }[] = [
  { value: 'compact', label: 'Compact', icon: Rows4 },
  { value: 'comfortable', label: 'Comfortable', icon: Rows3 },
  { value: 'spacious', label: 'Spacious', icon: Rows2 },
];

export function TreeTableToolbar({
  view,
  onSetView,
  filterState,
  onToggleFilter,
  showGaps,
  onToggleGaps,
  topologyMode,
  onTopologyModeChange,
  topologyReferenceName,
  search = '',
  onSearchChange,
  density = 'comfortable',
  onDensityChange,
  hiddenColumns,
  onHiddenColumnsChange,
}: TreeTableToolbarProps) {
  const isTableView = view === 'table';

  const handleDensity = useCallback(
    (next: TreeDensity) => {
      onDensityChange?.(next);
    },
    [onDensityChange],
  );

  return (
    <div className="border-b border-border bg-background">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-1.5">
          <TreeViewToggle view={view} onSetView={onSetView} />
          {isTableView && onSearchChange && (
            <>
              <Separator orientation="vertical" className="h-5 mx-0.5" />
              <div className="relative">
                <Search
                  className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                  aria-hidden
                />
                <Input
                  type="search"
                  placeholder="Filter by name..."
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="h-7 pl-7 w-48 text-xs"
                  aria-label="Filter persons by name"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <Button
            variant={filterState.sex.M ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onToggleFilter('sex', 'M')}
          >
            M
          </Button>
          <Button
            variant={filterState.sex.F ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onToggleFilter('sex', 'F')}
          >
            F
          </Button>
          <Button
            variant={filterState.sex.U ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onToggleFilter('sex', 'U')}
          >
            U
          </Button>

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          <Button
            variant={filterState.living.living ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onToggleFilter('living', 'living')}
          >
            Living
          </Button>
          <Button
            variant={filterState.living.deceased ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onToggleFilter('living', 'deceased')}
          >
            Deceased
          </Button>

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          <TopologyToggle
            mode={topologyMode}
            onModeChange={onTopologyModeChange}
            referenceName={topologyReferenceName}
          />

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          <Button
            variant={showGaps ? 'default' : 'secondary'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onToggleGaps}
          >
            <BarChart3 className="size-3.5" />
            Data Quality
          </Button>

          {isTableView && onDensityChange && (
            <>
              <Separator orientation="vertical" className="h-5 mx-0.5" />
              <div
                className="flex items-center rounded-md border bg-background overflow-hidden"
                role="radiogroup"
                aria-label="Row density"
              >
                {DENSITY_OPTIONS.map((opt, i) => {
                  const Icon = opt.icon;
                  const active = density === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      variant={active ? 'secondary' : 'ghost'}
                      size="sm"
                      role="radio"
                      aria-checked={active}
                      aria-label={`${opt.label} density`}
                      className={
                        'h-7 w-7 p-0 rounded-none ' +
                        (i === 0 ? 'rounded-l-md ' : '') +
                        (i === DENSITY_OPTIONS.length - 1 ? 'rounded-r-md ' : '')
                      }
                      onClick={() => handleDensity(opt.value)}
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </Button>
                  );
                })}
              </div>
            </>
          )}

          {isTableView && hiddenColumns && onHiddenColumnsChange && (
            <TreeColumnsDropdown
              hidden={hiddenColumns}
              onChange={onHiddenColumnsChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
