'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Star, ChevronDown, BarChart3 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { FilterState } from './tree-utils';
import { TreeExport } from './tree-export';

interface TreeToolbarProps {
  onAutoLayout: () => void;
  onTogglePalette: () => void;
  paletteOpen: boolean;
  layouts: { id: string; name: string; isDefault: boolean }[];
  activeLayoutId: string | null;
  activeLayoutName: string | null;
  onLoadLayout: (id: string) => void;
  onSaveAsNew: () => void;
  onUpdateLayout: () => void;
  onSetDefault: () => void;
  onDeleteLayout: () => void;
  onRenameLayout: () => void;
  filterState: FilterState;
  onToggleFilter: (category: 'sex' | 'living', key: string) => void;
  showGaps: boolean;
  onToggleGaps: () => void;
  view: 'canvas' | 'table';
  onToggleView: () => void;
}

export function TreeToolbar({
  onAutoLayout,
  onTogglePalette,
  paletteOpen,
  layouts,
  activeLayoutId,
  activeLayoutName,
  onLoadLayout,
  onSaveAsNew,
  onUpdateLayout,
  onSetDefault,
  onDeleteLayout,
  onRenameLayout,
  filterState,
  onToggleFilter,
  showGaps,
  onToggleGaps,
  view,
  onToggleView,
}: TreeToolbarProps) {
  return (
    <div className="absolute top-3 left-3 right-3 z-10 flex justify-between pointer-events-none">
      <div className="flex gap-1.5 pointer-events-auto">
        <Button variant="secondary" size="sm" className="shadow-sm" onClick={onAutoLayout}>
          Auto Layout
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="shadow-sm gap-1">
              Layouts
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {layouts.map((layout) => (
              <DropdownMenuItem
                key={layout.id}
                onClick={() => onLoadLayout(layout.id)}
                className={activeLayoutId === layout.id ? 'font-bold' : ''}
              >
                {layout.isDefault ? (
                  <Star className="size-3.5 fill-current" />
                ) : (
                  <span className="size-3.5" />
                )}
                {layout.name}
              </DropdownMenuItem>
            ))}

            {layouts.length > 0 && <DropdownMenuSeparator />}

            <DropdownMenuItem onClick={onSaveAsNew}>
              Save as new…
            </DropdownMenuItem>

            {activeLayoutId && (
              <DropdownMenuItem onClick={onUpdateLayout}>
                Update &ldquo;{activeLayoutName}&rdquo;
              </DropdownMenuItem>
            )}

            {activeLayoutId && <DropdownMenuSeparator />}

            {activeLayoutId && (
              <>
                <DropdownMenuItem onClick={onSetDefault}>
                  Set as default
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onRenameLayout}>
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={onDeleteLayout}>
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          className="shadow-sm"
          variant={paletteOpen ? 'default' : 'secondary'}
          onClick={onTogglePalette}
        >
          + New Person
        </Button>
      </div>
      <div className="flex gap-1.5 pointer-events-auto">
        <Button variant="secondary" size="sm" className="shadow-sm" disabled>
          Search
        </Button>

        <Button
          variant={filterState.sex.M ? 'secondary' : 'outline'}
          size="sm"
          className="shadow-sm h-7 text-xs"
          onClick={() => onToggleFilter('sex', 'M')}
        >
          M
        </Button>
        <Button
          variant={filterState.sex.F ? 'secondary' : 'outline'}
          size="sm"
          className="shadow-sm h-7 text-xs"
          onClick={() => onToggleFilter('sex', 'F')}
        >
          F
        </Button>
        <Button
          variant={filterState.sex.U ? 'secondary' : 'outline'}
          size="sm"
          className="shadow-sm h-7 text-xs"
          onClick={() => onToggleFilter('sex', 'U')}
        >
          U
        </Button>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button
          variant={filterState.living.living ? 'secondary' : 'outline'}
          size="sm"
          className="shadow-sm h-7 text-xs"
          onClick={() => onToggleFilter('living', 'living')}
        >
          Living
        </Button>
        <Button
          variant={filterState.living.deceased ? 'secondary' : 'outline'}
          size="sm"
          className="shadow-sm h-7 text-xs"
          onClick={() => onToggleFilter('living', 'deceased')}
        >
          Deceased
        </Button>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button
          variant={showGaps ? 'default' : 'secondary'}
          size="sm"
          className="shadow-sm h-7 text-xs gap-1"
          onClick={onToggleGaps}
        >
          <BarChart3 className="size-3.5" />
          Data Quality
        </Button>

        <Button
          variant="secondary"
          size="sm"
          className="shadow-sm"
          onClick={onToggleView}
        >
          {view === 'canvas' ? 'Table View' : 'Canvas View'}
        </Button>

        <TreeExport />
      </div>
    </div>
  );
}
