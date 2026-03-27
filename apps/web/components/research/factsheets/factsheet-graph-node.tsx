'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';

export interface FactsheetNodeData {
  title: string;
  status: string;
  entityType: string;
  factCount: number;
  isUnanchored: boolean;
  isSelected: boolean;
  [key: string]: unknown;
}

const BORDER_COLORS: Record<string, string> = {
  draft: 'border-indigo-400',
  ready: 'border-green-500',
  promoted: 'border-indigo-600',
  merged: 'border-cyan-500',
  dismissed: 'border-gray-300',
};

function FactsheetGraphNodeInner({ data }: NodeProps) {
  const nodeData = data as unknown as FactsheetNodeData;
  const statusCfg = FACTSHEET_STATUS_CONFIG[nodeData.status] ?? FACTSHEET_STATUS_CONFIG.draft;
  const borderColor = nodeData.isUnanchored
    ? 'border-amber-500'
    : BORDER_COLORS[nodeData.status] ?? 'border-gray-300';

  return (
    <>
      <Handle type="target" position={Position.Top} className="!invisible" />
      <div
        className={cn(
          'w-40 rounded-lg border-2 bg-background p-2.5 shadow-sm transition-shadow',
          borderColor,
          nodeData.isSelected && 'ring-2 ring-primary/50',
          nodeData.status === 'dismissed' && 'opacity-50'
        )}
      >
        <div className="truncate text-xs font-semibold">{nodeData.title}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {nodeData.factCount} facts
          {nodeData.isUnanchored && <span className="ml-1 text-amber-600">⚠</span>}
        </div>
        <div className="mt-1.5 flex gap-1">
          <span className={cn('rounded px-1 py-0.5 text-[9px] font-medium', statusCfg.className)}>
            {statusCfg.label}
          </span>
          {nodeData.entityType !== 'person' && (
            <span className="rounded bg-muted px-1 py-0.5 text-[9px]">{nodeData.entityType}</span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!invisible" />
    </>
  );
}

export const FactsheetGraphNode = memo(FactsheetGraphNodeInner);
