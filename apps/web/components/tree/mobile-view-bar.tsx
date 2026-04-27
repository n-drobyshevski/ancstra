'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { TopologyMode } from './topology-toggle';
import { EllipsisVertical, BarChart3 } from 'lucide-react';
import { TreeViewToggle } from './tree-view-toggle';
import type { FilterState } from './tree-utils';
import type { TreeDensity } from '@/lib/tree/search-params';

interface MobileViewBarProps {
  view: 'canvas' | 'table';
  onSetView: (v: 'canvas' | 'table') => void;
  filterState: FilterState;
  onToggleFilter: (category: 'sex' | 'living', key: string) => void;
  showGaps: boolean;
  onToggleGaps: () => void;
  topologyMode: TopologyMode;
  onTopologyModeChange: (mode: TopologyMode) => void;
  topologyReferenceName: string | null;
  /** Density (table view only). */
  density?: TreeDensity;
  onDensityChange?: (next: TreeDensity) => void;
  /** Render prop for view-specific overflow items (auto layout, export, etc.) */
  extraMenuItems?: ReactNode;
}

export function MobileViewBar({
  view,
  onSetView,
  filterState,
  onToggleFilter,
  showGaps,
  onToggleGaps,
  topologyMode,
  onTopologyModeChange,
  topologyReferenceName,
  density,
  onDensityChange,
  extraMenuItems,
}: MobileViewBarProps) {
  const hasActiveFilter =
    !filterState.sex.M ||
    !filterState.sex.F ||
    !filterState.sex.U ||
    !filterState.living.living ||
    !filterState.living.deceased ||
    showGaps ||
    topologyMode !== 'all';

  return (
    <div className="flex h-11 items-center gap-1 border-b bg-background px-2 shrink-0">
      <span className="flex-1 truncate text-sm font-semibold px-1">Family Tree</span>

      <TreeViewToggle view={view} onSetView={onSetView} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 relative"
            aria-label="More options"
          >
            <EllipsisVertical className="size-4" />
            {hasActiveFilter && (
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          {/* Sex filters */}
          <DropdownMenuCheckboxItem
            checked={filterState.sex.M}
            onCheckedChange={() => onToggleFilter('sex', 'M')}
          >
            M
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filterState.sex.F}
            onCheckedChange={() => onToggleFilter('sex', 'F')}
          >
            F
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filterState.sex.U}
            onCheckedChange={() => onToggleFilter('sex', 'U')}
          >
            U
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />

          {/* Living filters */}
          <DropdownMenuCheckboxItem
            checked={filterState.living.living}
            onCheckedChange={() => onToggleFilter('living', 'living')}
          >
            Living
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filterState.living.deceased}
            onCheckedChange={() => onToggleFilter('living', 'deceased')}
          >
            Deceased
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {topologyReferenceName ? `Topology — ${topologyReferenceName}` : 'Topology (select a person first)'}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={topologyMode}
            onValueChange={(v) => onTopologyModeChange(v as TopologyMode)}
          >
            <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ancestors" disabled={!topologyReferenceName}>
              Ancestors
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="descendants" disabled={!topologyReferenceName}>
              Descendants
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          {/* Data quality toggle */}
          <DropdownMenuCheckboxItem checked={showGaps} onCheckedChange={onToggleGaps}>
            <BarChart3 className="mr-2 size-4" />
            Data Quality
          </DropdownMenuCheckboxItem>

          {/* Density (table view only) */}
          {view === 'table' && onDensityChange && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Row density
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={density ?? 'compact'}
                onValueChange={(v) => onDensityChange(v as TreeDensity)}
              >
                <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="spacious">Spacious</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </>
          )}

          {/* View-specific extras (auto layout, export, etc.) */}
          {extraMenuItems}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
