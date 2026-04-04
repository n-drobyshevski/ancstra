'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TreeViewToggleProps {
  view: 'canvas' | 'table';
  onSetView: (v: 'canvas' | 'table') => void;
}

export function TreeViewToggle({ view, onSetView }: TreeViewToggleProps) {
  return (
    <Tabs
      value={view}
      onValueChange={(v) => onSetView(v as 'canvas' | 'table')}
      className="flex-row gap-0"
    >
      <TabsList className="h-7">
        <TabsTrigger value="canvas" className="text-xs px-3 py-0.5">
          Canvas
        </TabsTrigger>
        <TabsTrigger value="table" className="text-xs px-3 py-0.5">
          Table
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
