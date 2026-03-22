'use client';

import {
  LayoutGrid,
  Maximize2,
  StickyNote,
  Map,
  PanelLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CanvasToolbarProps {
  onAutoLayout: () => void;
  onZoomFit: () => void;
  onAddNote: () => void;
  onToggleMiniMap: () => void;
  miniMapVisible: boolean;
  onTogglePalette: () => void;
  paletteOpen: boolean;
}

export function CanvasToolbar({
  onAutoLayout,
  onZoomFit,
  onAddNote,
  onToggleMiniMap,
  miniMapVisible,
  onTogglePalette,
  paletteOpen,
}: CanvasToolbarProps) {
  const items = [
    {
      icon: PanelLeft,
      label: paletteOpen ? 'Hide Sources' : 'Show Sources',
      onClick: onTogglePalette,
      active: paletteOpen,
      shortcut: undefined,
    },
    {
      icon: LayoutGrid,
      label: 'Auto Layout',
      onClick: onAutoLayout,
      active: false,
      shortcut: 'Ctrl+Shift+L',
    },
    {
      icon: Maximize2,
      label: 'Zoom to Fit',
      onClick: onZoomFit,
      active: false,
      shortcut: 'Ctrl+Shift+F',
    },
    {
      icon: StickyNote,
      label: 'Add Note',
      onClick: onAddNote,
      active: false,
      shortcut: 'N',
    },
    {
      icon: Map,
      label: miniMapVisible ? 'Hide MiniMap' : 'Show MiniMap',
      onClick: onToggleMiniMap,
      active: miniMapVisible,
      shortcut: undefined,
    },
  ];

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/80 backdrop-blur-sm px-1.5 py-1 shadow-sm">
      {items.map((item) => (
        <Tooltip key={item.label}>
          <TooltipTrigger asChild>
            <Button
              variant={item.active ? 'secondary' : 'ghost'}
              size="icon"
              className="size-7"
              onClick={item.onClick}
            >
              <item.icon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {item.label}
            {item.shortcut && (
              <span className="ml-1.5 text-muted-foreground">
                {item.shortcut}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
