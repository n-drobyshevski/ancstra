'use client';

import { Button } from '@/components/ui/button';
import { Users, X } from 'lucide-react';

interface PersonPaletteProps {
  onClose: () => void;
}

export function PersonPalette({ onClose }: PersonPaletteProps) {
  function onDragStart(event: React.DragEvent) {
    event.dataTransfer.setData('application/ancstra', 'new-person');
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="absolute top-0 left-0 z-20 h-full w-[250px] border-r bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Person Palette</h3>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <div
        className="flex items-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-3 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={onDragStart}
      >
        <Users className="size-5 text-primary" />
        <div>
          <div className="text-sm font-medium">New Person</div>
          <div className="text-xs text-muted-foreground">Drag to canvas</div>
        </div>
      </div>
    </div>
  );
}
