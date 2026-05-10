'use client';

import { useTranslations } from 'next-intl';
import type { TreeData } from '@ancstra/shared';
import { Button } from '@/components/ui/button';
import { Menubar } from '@/components/ui/menubar';
import { Separator } from '@/components/ui/separator';
import { RoleGate } from '@/components/auth/role-gate';
import type { FilterState } from './tree-utils';
import type { TreeViewMenuProps } from './tree-view-menu';
import { TreeViewToggle } from './tree-view-toggle';
import { TreeViewMenu } from './tree-view-menu';
import { TreeExportMenu } from './tree-export-menu';
import { TreeSurnameHighlightPopover } from './tree-surname-highlight-popover';
import { TreeFiltersTrigger } from './tree-filters-trigger';
import type { SurnameHighlightStyle } from '@/lib/tree/view-prefs-storage';

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

  // Filter panel — controlled by the canvas (which mounts the panel inside
  // its viewport). The trigger here just toggles the canvas's state.
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;

  // Surname-branch highlight (right cluster, before filter pills)
  treeData: TreeData;
  activeHighlightSurname: string | null;
  onHighlightSurnameChange: (surname: string | null) => void;
  surnameHighlightStyle: SurnameHighlightStyle;
  onSurnameHighlightStyleChange: (s: SurnameHighlightStyle) => void;
}

export function TreeToolbar(props: TreeToolbarProps) {
  // Partition: pull toolbar-only props out so they are NOT forwarded into
  // <TreeViewMenu />. The rest is structurally `TreeViewMenuProps` because
  // `TreeToolbarProps extends TreeViewMenuProps` plus the toolbar-only fields
  // below — removing them leaves exactly the menu's prop surface.
  const {
    onTogglePalette,
    paletteOpen,
    view,
    onSetView,
    filterState,
    onToggleFilter,
    filtersOpen,
    onFiltersOpenChange,
    treeData,
    activeHighlightSurname,
    onHighlightSurnameChange,
    surnameHighlightStyle,
    onSurnameHighlightStyleChange,
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

        <TreeSurnameHighlightPopover
          treeData={treeData}
          activeSurname={activeHighlightSurname}
          onChangeSurname={onHighlightSurnameChange}
          highlightStyle={surnameHighlightStyle}
          onChangeHighlightStyle={onSurnameHighlightStyleChange}
        />

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <TreeFiltersTrigger
          open={filtersOpen}
          onOpenChange={onFiltersOpenChange}
        />

        <Separator orientation="vertical" className="h-5 mx-0.5" />

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
