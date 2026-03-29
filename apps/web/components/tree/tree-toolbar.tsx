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
import type { FilterState, NodeStyle } from './tree-utils';
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
  onSetView: (v: 'canvas' | 'table') => void;
  nodeStyle: NodeStyle;
  onNodeStyleChange: (style: NodeStyle) => void;
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
  onSetView,
  nodeStyle,
  onNodeStyleChange,
}: TreeToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
      <div className="flex items-center gap-1.5">
        {/* Segmented view toggle — matches factsheets Detail/Graph pattern */}
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            onClick={() => onSetView('canvas')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              view === 'canvas'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Canvas
          </button>
          <button
            onClick={() => onSetView('table')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              view === 'table'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Table
          </button>
        </div>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        <Button variant="secondary" size="sm" onClick={onAutoLayout}>
          Auto Layout
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-1">
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

            <div className="px-2 py-1.5">
              <div className="text-[11px] text-muted-foreground mb-1">Node style</div>
              <div className="flex overflow-hidden rounded-md border border-border">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNodeStyleChange('wide'); }}
                  className={`flex-1 px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    nodeStyle === 'wide'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Wide
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNodeStyleChange('compact'); }}
                  className={`flex-1 px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    nodeStyle === 'compact'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Compact
                </button>
              </div>
            </div>

            <DropdownMenuSeparator />

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
          variant={paletteOpen ? 'default' : 'secondary'}
          onClick={onTogglePalette}
        >
          + New Person
        </Button>
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

        <TreeExport />
      </div>
    </div>
  );
}
