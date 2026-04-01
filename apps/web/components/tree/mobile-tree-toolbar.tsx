'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { EllipsisVertical, BarChart3, LayoutGrid, Download } from 'lucide-react';
import type { FilterState } from './tree-utils';

interface MobileTreeToolbarProps {
  filterState: FilterState;
  onToggleFilter: (category: 'sex' | 'living', key: string) => void;
  showGaps: boolean;
  onToggleGaps: () => void;
  onAutoLayout: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportPdf: () => void;
}

export function MobileTreeToolbar({
  filterState,
  onToggleFilter,
  showGaps,
  onToggleGaps,
  onAutoLayout,
  onExportPng,
  onExportSvg,
  onExportPdf,
}: MobileTreeToolbarProps) {
  const hasActiveFilter =
    !filterState.sex.M ||
    !filterState.sex.F ||
    !filterState.sex.U ||
    !filterState.living.living ||
    !filterState.living.deceased ||
    showGaps;

  return (
    <div className="flex h-11 items-center gap-1 border-b bg-background px-2">
      {/* Title */}
      <span className="flex-1 truncate text-sm font-semibold px-1">Family Tree</span>

      {/* Overflow menu */}
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

          {/* Auto layout */}
          <DropdownMenuItem onSelect={onAutoLayout}>
            <LayoutGrid className="mr-2 size-4" />
            Auto Layout
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Export options */}
          <DropdownMenuItem onSelect={onExportPng}>
            <Download className="mr-2 size-4" />
            Export PNG
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportSvg}>
            <Download className="mr-2 size-4" />
            Export SVG
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportPdf}>
            <Download className="mr-2 size-4" />
            Export PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
