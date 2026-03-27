// apps/web/components/research/canvas/center-factsheet-node.tsx
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { CenterFactsheetNodeData } from './factsheet-graph-utils';

type CenterNodeType = Node<CenterFactsheetNodeData, 'centerFactsheet'>;

function CenterFactsheetNodeComponent({ data }: NodeProps<CenterNodeType>) {
  return (
    <>
      <Handle type="source" position={Position.Top} className="!w-2 !h-2 !bg-white/40" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-white/40" />
      <Handle type="source" position={Position.Left} className="!w-2 !h-2 !bg-white/40" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-white/40" />
      <div className="w-[160px] rounded-xl bg-primary text-primary-foreground p-3 shadow-lg">
        <div className="text-[13px] font-bold">{data.factsheet.title}</div>
        <div className="text-[10px] opacity-80">Factsheet · {data.factCount} facts</div>
      </div>
    </>
  );
}

export const CenterFactsheetNode = memo(CenterFactsheetNodeComponent);
