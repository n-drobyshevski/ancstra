'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Menubar } from '@/components/ui/menubar';
import { Separator } from '@/components/ui/separator';
import { RoleGate } from '@/components/auth/role-gate';
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
  const t = useTranslations('tree.toolbar');
  const tSex = useTranslations('tree.toolbar.sex');
  const tLiving = useTranslations('tree.toolbar.living');

  return (
    <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
      <div className="flex items-center gap-1.5">
        <TreeViewToggle view={view} onSetView={onSetView} />

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <RoleGate permission="person:create">
          <Button
            size="sm"
            variant={paletteOpen ? 'default' : 'secondary'}
            onClick={onTogglePalette}
          >
            {t('newPerson')}
          </Button>
        </RoleGate>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Menubar className="border-0 bg-transparent p-0 h-7">
          <TreeViewMenu {...viewMenuProps} />
          <TreeExportMenu />
        </Menubar>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" disabled>
          {t('search')}
        </Button>

        <Button
          variant={filterState.sex.M ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onToggleFilter('sex', 'M')}
        >
          {tSex('M')}
        </Button>
        <Button
          variant={filterState.sex.F ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onToggleFilter('sex', 'F')}
        >
          {tSex('F')}
        </Button>
        <Button
          variant={filterState.sex.U ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onToggleFilter('sex', 'U')}
        >
          {tSex('U')}
        </Button>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button
          variant={filterState.living.living ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onToggleFilter('living', 'living')}
        >
          {tLiving('living')}
        </Button>
        <Button
          variant={filterState.living.deceased ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onToggleFilter('living', 'deceased')}
        >
          {tLiving('deceased')}
        </Button>
      </div>
    </div>
  );
}
