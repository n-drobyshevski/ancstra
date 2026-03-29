// apps/web/components/research/canvas/source-research-node.tsx
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';
import type { SourceResearchNodeData } from './factsheet-graph-utils';

type SourceResearchNodeType = Node<SourceResearchNodeData, 'sourceResearchNode'>;

function SourceResearchNodeComponent({ data }: NodeProps<SourceResearchNodeType>) {
  return (
    <>
      <Handle type="source" position={Position.Left} className="!w-1.5 !h-1.5 !bg-primary/60" />
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-primary/60" />
      <div className="w-[110px] rounded-md bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 shadow-sm">
        <div className="p-1.5">
          <div className="flex items-center gap-1">
            <FileText className="size-3 text-primary shrink-0" />
            <span className="text-[9px] font-semibold text-primary dark:text-primary/90 truncate">{data.title}</span>
          </div>
          {data.provider && (
            <div className="text-[9px] text-primary/60 dark:text-primary/50 truncate">{data.provider}</div>
          )}
        </div>
      </div>
    </>
  );
}

export const SourceResearchNode = memo(SourceResearchNodeComponent);
