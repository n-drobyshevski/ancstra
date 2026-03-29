'use client';

import { useState, useMemo } from 'react';
import { Search, GripVertical, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ResearchItemShape } from './canvas-utils';

interface SourcePaletteProps {
  researchItems: ResearchItemShape[];
  nodesOnCanvas: Set<string>;
  onClose: () => void;
}

export function SourcePalette({
  researchItems,
  nodesOnCanvas,
  onClose,
}: SourcePaletteProps) {
  const [filter, setFilter] = useState('');

  const drafts = useMemo(
    () =>
      researchItems.filter(
        (it) =>
          it.status !== 'promoted' &&
          it.status !== 'dismissed' &&
          it.title.toLowerCase().includes(filter.toLowerCase()),
      ),
    [researchItems, filter],
  );

  const promoted = useMemo(
    () =>
      researchItems.filter(
        (it) =>
          it.status === 'promoted' &&
          it.title.toLowerCase().includes(filter.toLowerCase()),
      ),
    [researchItems, filter],
  );

  function handleDragStart(
    event: React.DragEvent,
    item: ResearchItemShape,
  ) {
    const nodeType = item.status === 'promoted' ? 'source' : 'research_item';
    event.dataTransfer.setData(
      'application/ancstra-research',
      JSON.stringify({
        id: item.id,
        type: nodeType,
        title: item.title,
        snippet: item.snippet,
        status: item.status,
        providerId: item.providerId,
      }),
    );
    event.dataTransfer.effectAllowed = 'move';
  }

  function isOnCanvas(item: ResearchItemShape) {
    const nodeType = item.status === 'promoted' ? 'source' : 'research_item';
    return nodesOnCanvas.has(`${nodeType}-${item.id}`);
  }

  return (
    <div className="absolute top-0 left-0 z-20 flex h-full w-[260px] flex-col border-r border-border bg-card shadow-lg transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-sm font-semibold text-foreground">
          Sources{' '}
          <span className="text-muted-foreground font-normal">
            ({researchItems.length})
          </span>
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={onClose}
          aria-label="Close source palette"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter sources..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-3">
        {/* Research Items */}
        {drafts.length > 0 && (
          <div>
            <p className="px-1 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Research Items
            </p>
            <div className="space-y-1">
              {drafts.map((item) => (
                <PaletteItem
                  key={item.id}
                  item={item}
                  onCanvas={isOnCanvas(item)}
                  borderColor="border-l-primary"
                  onDragStart={handleDragStart}
                />
              ))}
            </div>
          </div>
        )}

        {/* Promoted Sources */}
        {promoted.length > 0 && (
          <div>
            <p className="px-1 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Promoted Sources
            </p>
            <div className="space-y-1">
              {promoted.map((item) => (
                <PaletteItem
                  key={item.id}
                  item={item}
                  onCanvas={isOnCanvas(item)}
                  borderColor="border-l-green-500"
                  onDragStart={handleDragStart}
                />
              ))}
            </div>
          </div>
        )}

        {drafts.length === 0 && promoted.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">
            No sources match filter.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaletteItem
// ---------------------------------------------------------------------------

function PaletteItem({
  item,
  onCanvas,
  borderColor,
  onDragStart,
}: {
  item: ResearchItemShape;
  onCanvas: boolean;
  borderColor: string;
  onDragStart: (e: React.DragEvent, item: ResearchItemShape) => void;
}) {
  return (
    <div
      draggable={!onCanvas}
      onDragStart={(e) => onDragStart(e, item)}
      className={`flex items-center gap-1.5 rounded-md border-l-[3px] ${borderColor} bg-muted/50 px-2 py-1.5 cursor-grab active:cursor-grabbing transition-opacity ${
        onCanvas ? 'opacity-50 cursor-default' : ''
      }`}
    >
      {!onCanvas && (
        <GripVertical className="size-3 shrink-0 text-muted-foreground/50" />
      )}
      {onCanvas && (
        <Check className="size-3 shrink-0 text-green-500" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-foreground truncate">
          {item.title}
        </p>
        {item.providerId && (
          <p className="text-[9px] text-muted-foreground truncate">
            {item.providerId}
          </p>
        )}
      </div>
    </div>
  );
}
