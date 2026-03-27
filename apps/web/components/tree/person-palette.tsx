'use client';

import { Button } from '@/components/ui/button';
import { Users, X, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFactsheets } from '@/lib/research/factsheet-client';
import { FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';

interface PersonPaletteProps {
  onClose: () => void;
}

export function PersonPalette({ onClose }: PersonPaletteProps) {
  const { factsheets } = useFactsheets(''); // empty personId gets all factsheets

  // Only show factsheets that can be promoted
  const draggableSheets = factsheets.filter(
    (fs) => fs.status === 'draft' || fs.status === 'ready',
  );

  function onDragStartPerson(event: React.DragEvent) {
    event.dataTransfer.setData('application/ancstra', 'new-person');
    event.dataTransfer.effectAllowed = 'move';
  }

  function onDragStartFactsheet(event: React.DragEvent, factsheetId: string) {
    event.dataTransfer.setData('application/ancstra', `factsheet:${factsheetId}`);
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="absolute top-0 left-0 z-20 h-full w-[250px] border-r bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-sm font-medium">Palette</h3>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close palette">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {/* New Person drag item */}
        <div
          className="flex items-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-3 cursor-grab active:cursor-grabbing"
          draggable
          onDragStart={onDragStartPerson}
        >
          <Users className="size-5 text-primary" />
          <div>
            <div className="text-sm font-medium">New Person</div>
            <div className="text-xs text-muted-foreground">Drag to canvas</div>
          </div>
        </div>

        {/* Factsheets section */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Layers className="size-3.5 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Factsheets
            </h4>
          </div>

          {draggableSheets.length === 0 ? (
            <p className="text-[10px] text-muted-foreground py-2">
              No factsheets to place. Create one from Research.
            </p>
          ) : (
            <div className="space-y-1.5">
              {draggableSheets.map((fs) => {
                const statusCfg = FACTSHEET_STATUS_CONFIG[fs.status] ?? FACTSHEET_STATUS_CONFIG.draft;
                return (
                  <div
                    key={fs.id}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-2.5 cursor-grab active:cursor-grabbing hover:bg-accent/5 transition-colors"
                    draggable
                    onDragStart={(e) => onDragStartFactsheet(e, fs.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{fs.title}</p>
                    </div>
                    <span className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-medium', statusCfg.className)}>
                      {statusCfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
