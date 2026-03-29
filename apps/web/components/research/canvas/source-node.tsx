'use client';

import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { CanvasNodeData } from './canvas-utils';

type SourceNodeType = Node<CanvasNodeData, 'source'>;

const statusColors: Record<string, { dot: string; badge: string; badgeText: string }> = {
  draft: { dot: 'bg-primary', badge: 'bg-primary/10 text-primary border-primary/20', badgeText: 'Draft' },
  promoted: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-800 border-green-200', badgeText: 'Promoted' },
  dismissed: { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600 border-gray-200', badgeText: 'Dismissed' },
};

const confidenceColors: Record<string, string> = {
  high: 'bg-green-500',
  medium: 'bg-amber-400',
  low: 'bg-red-500',
  disputed: 'bg-red-600',
};

function SourceNodeComponent({ data, selected }: NodeProps<SourceNodeType>) {
  const status = data.status ?? 'draft';
  const isPromoted = status === 'promoted';
  const colors = statusColors[status] ?? statusColors.draft;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-muted-foreground/40"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-muted-foreground/40"
      />
      <div
        className={`w-[220px] min-h-[100px] rounded-lg bg-card shadow-sm transition-all ${
          isPromoted ? 'border border-border' : 'border border-dashed border-border'
        } ${selected ? 'ring-2 ring-indigo-500 shadow-md' : ''}`}
      >
        <div className="p-3 space-y-2">
          {/* Status badge row */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${colors.badge}`}
            >
              <span className={`mr-1 inline-block size-1.5 rounded-full ${colors.dot}`} />
              {colors.badgeText}
            </span>
            {data.providerId && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                {data.providerId}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-[13px] font-semibold text-foreground line-clamp-2 leading-tight">
            {data.title}
          </p>

          {/* Snippet */}
          {data.snippet && (
            <p className="text-[11px] text-muted-foreground line-clamp-3 leading-snug">
              {data.snippet}
            </p>
          )}

          {/* Confidence dot */}
          {data.confidence && (
            <div className="flex items-center gap-1 pt-0.5">
              <span
                className={`inline-block size-2 rounded-full ${
                  confidenceColors[data.confidence] ?? 'bg-gray-400'
                }`}
              />
              <span className="text-[10px] text-muted-foreground capitalize">
                {data.confidence}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const SourceNode = memo(SourceNodeComponent);
