'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BarChart3 } from 'lucide-react';
import { TreeViewToggle } from './tree-view-toggle';
import type { FilterState } from './tree-utils';

interface TreeTableToolbarProps {
  view: 'canvas' | 'table';
  onSetView: (v: 'canvas' | 'table') => void;
  filterState: FilterState;
  onToggleFilter: (category: 'sex' | 'living', key: string) => void;
  showGaps: boolean;
  onToggleGaps: () => void;
}

export function TreeTableToolbar({
  view,
  onSetView,
  filterState,
  onToggleFilter,
  showGaps,
  onToggleGaps,
}: TreeTableToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
      <div className="flex items-center gap-1.5">
        <TreeViewToggle view={view} onSetView={onSetView} />
      </div>
      <div className="flex items-center gap-1.5">
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

        <Button
          variant={showGaps ? 'default' : 'secondary'}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onToggleGaps}
        >
          <BarChart3 className="size-3.5" />
          Data Quality
        </Button>
      </div>
    </div>
  );
}
