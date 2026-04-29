'use client';

import { Button } from '@/components/ui/button';
import { Menubar } from '@/components/ui/menubar';
import { Separator } from '@/components/ui/separator';
import type { FilterState } from './tree-utils';
import type { TreeViewMenuProps } from './tree-view-menu';
import { TreeViewToggle } from './tree-view-toggle';
import { TreeViewMenu } from './tree-view-menu';
import { TreeExportMenu } from './tree-export-menu';

interface TreeToolbarProps extends TreeViewMenuProps {
  // Palette
  onTogglePalette: () => void;
  paletteOpen: boolean;

  // View toggle
  view: 'canvas' | 'table';
  onSetView: (v: 'canvas' | 'table') => void;

  // Filters (right side)
  filterState: FilterState;
  onToggleFilter: (category: 'sex' | 'living', key: string) => void;
}

export function TreeToolbar(props: TreeToolbarProps) {
  // Partition: pull toolbar-only props out so they are NOT forwarded into
  // <TreeViewMenu />. The rest is structurally `TreeViewMenuProps` because
  // `TreeToolbarProps extends TreeViewMenuProps` plus the six toolbar-only
  // fields below — removing them leaves exactly the menu's prop surface.
  const {
    onTogglePalette,
    paletteOpen,
    view,
    onSetView,
    filterState,
    onToggleFilter,
    ...viewMenuProps
  } = props;

  return (
    <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
      <div className="flex items-center gap-1.5">
        <TreeViewToggle view={view} onSetView={onSetView} />

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button
          size="sm"
          variant={paletteOpen ? 'default' : 'secondary'}
          onClick={onTogglePalette}
        >
          + New Person
        </Button>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Menubar className="border-0 bg-transparent p-0 h-7">
          <TreeViewMenu {...viewMenuProps} />
          <TreeExportMenu />
        </Menubar>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" disabled>
          Search
        </Button>

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
      </div>
    </div>
  );
}
