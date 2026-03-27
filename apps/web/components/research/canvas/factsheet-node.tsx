// apps/web/components/research/canvas/factsheet-node.tsx
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import type { FactsheetNodeData } from './factsheet-graph-utils';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  ready: { label: 'Ready', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  promoted: { label: 'Promoted', className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
  merged: { label: 'Merged', className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
  dismissed: { label: 'Dismissed', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
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
