// apps/web/components/research/canvas/fact-node.tsx
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { FactNodeData } from './factsheet-graph-utils';

type FactNodeType = Node<FactNodeData, 'factNode'>;

const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#22c55e',
  medium: '#f59e0b',
  low: '#ef4444',
  disputed: '#dc2626',
};

const FACT_TYPE_LABELS: Record<string, string> = {
  name: 'Name',
  birth_date: 'Birth Date',
  birth_place: 'Birth Place',
  death_date: 'Death Date',
  death_place: 'Death Place',
  marriage_date: 'Marriage Date',
  marriage_place: 'Marriage Place',
  residence: 'Residence',
  occupation: 'Occupation',
  immigration: 'Immigration',
  military_service: 'Military',
  religion: 'Religion',
  ethnicity: 'Ethnicity',
  parent_name: 'Parent Name',
  spouse_name: 'Spouse Name',
  child_name: 'Child Name',
  other: 'Other',
};

function FactNodeComponent({ data }: NodeProps<FactNodeType>) {
  const { fact, hasConflict } = data;
  const borderColor = CONFIDENCE_COLORS[fact.confidence] ?? CONFIDENCE_COLORS.medium;
  const label = FACT_TYPE_LABELS[fact.factType] ?? fact.factType;

  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-muted-foreground/40" />
      <Handle type="target" position={Position.Right} className="!w-1.5 !h-1.5 !bg-muted-foreground/40" />
      <div
        className={`w-[130px] rounded-md bg-card border shadow-sm ${
          hasConflict ? 'ring-2 ring-destructive animate-pulse' : ''
        }`}
        style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
      >
        <div className="p-1.5">
          <div className="text-[10px] font-semibold text-foreground">{label}</div>
          <div className="text-[10px] text-muted-foreground truncate">{fact.factValue}</div>
          <div className="flex items-center gap-1 mt-1">
            <span
              className="inline-block size-[5px] rounded-full"
              style={{ backgroundColor: borderColor }}
            />
            <span className="text-[9px] text-muted-foreground">{fact.confidence}</span>
          </div>
        </div>
      </div>
    </>
  );
}

export const FactNode = memo(FactNodeComponent);
