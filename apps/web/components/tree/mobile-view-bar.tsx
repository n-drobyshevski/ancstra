'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { EllipsisVertical, BarChart3 } from 'lucide-react';
import { TreeViewToggle } from './tree-view-toggle';
import type { FilterState } from './tree-utils';

interface MobileViewBarProps {
  view: 'canvas' | 'table';
  onSetView: (v: 'canvas' | 'table') => void;
  filterState: FilterState;
  onToggleFilter: (category: 'sex' | 'living', key: string) => void;
  showGaps: boolean;
  onToggleGaps: () => void;
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
  extraMenuItems,
}: MobileViewBarProps) {
  const hasActiveFilter =
    !filterState.sex.M ||
    !filterState.sex.F ||
    !filterState.sex.U ||
    !filterState.living.living ||
    !filterState.living.deceased ||
    showGaps;

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

          {/* Data quality toggle */}
          <DropdownMenuCheckboxItem checked={showGaps} onCheckedChange={onToggleGaps}>
            <BarChart3 className="mr-2 size-4" />
            Data Quality
          </DropdownMenuCheckboxItem>

          {/* View-specific extras (auto layout, export, etc.) */}
          {extraMenuItems}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
