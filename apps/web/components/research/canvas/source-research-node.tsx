// apps/web/components/research/canvas/source-research-node.tsx
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';
import type { SourceResearchNodeData } from './factsheet-graph-utils';

type SourceResearchNodeType = Node<SourceResearchNodeData, 'sourceResearchNode'>;

function SourceResearchNodeComponent({ data }: NodeProps<SourceResearchNodeType>) {
  return (
    <>
      <Handle type="source" position={Position.Left} className="!w-1.5 !h-1.5 !bg-amber-400/60" />
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-amber-400/60" />
      <div className="w-[110px] rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 shadow-sm">
        <div className="p-1.5">
          <div className="flex items-center gap-1">
            <FileText className="size-3 text-amber-700 dark:text-amber-400 shrink-0" />
            <span className="text-[9px] font-semibold text-amber-800 dark:text-amber-300 truncate">{data.title}</span>
          </div>
          {data.provider && (
            <div className="text-[9px] text-amber-600 dark:text-amber-500 truncate">{data.provider}</div>
          )}
        </div>
      </div>
    </>
  );
}

export const SourceResearchNode = memo(SourceResearchNodeComponent);
