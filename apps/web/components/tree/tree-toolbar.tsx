'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Star, ChevronDown } from 'lucide-react';

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
        <Button variant="secondary" size="sm" className="shadow-sm" disabled>
          Filter
        </Button>
        <Button variant="secondary" size="sm" className="shadow-sm" disabled>
          Export
        </Button>
      </div>
    </div>
  );
}
