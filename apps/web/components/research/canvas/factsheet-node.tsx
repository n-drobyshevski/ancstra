// apps/web/components/research/canvas/factsheet-node.tsx
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import type { FactsheetNodeData } from './factsheet-graph-utils';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-status-warning-bg text-status-warning-text' },
  ready: { label: 'Ready', className: 'bg-status-success-bg text-status-success-text' },
  promoted: { label: 'Promoted', className: 'bg-status-info-bg text-status-info-text' },
  merged: { label: 'Merged', className: 'bg-status-merged-bg text-status-merged-text' },
  dismissed: { label: 'Dismissed', className: 'bg-status-neutral-bg text-status-neutral-text' },
};

type FactsheetNodeType = Node<FactsheetNodeData, 'factsheetNode'>;

function FactsheetNodeComponent({ data, selected }: NodeProps<FactsheetNodeType>) {
  const { factsheet, factCount, linkCount } = data;
  const config = STATUS_CONFIG[factsheet.status] ?? STATUS_CONFIG.draft;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-muted-foreground/40" />
      <div
        className={`w-[160px] rounded-lg bg-card border shadow-sm cursor-pointer transition-all hover:shadow-md ${
          selected ? 'ring-2 ring-primary shadow-md' : ''
        }`}
      >
        <div className="p-2">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="truncate text-[12px] font-semibold text-foreground">{factsheet.title}</span>
            <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${config.className}`}>
              {config.label}
            </Badge>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {factCount} facts · {linkCount} links
          </div>
        </div>
      </div>
    </>
  );
}

export const FactsheetNode = memo(FactsheetNodeComponent);
