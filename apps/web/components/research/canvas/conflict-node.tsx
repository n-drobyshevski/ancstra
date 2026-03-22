'use client';

import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import type { CanvasNodeData } from './canvas-utils';

type ConflictNodeType = Node<CanvasNodeData, 'conflict'>;

const factTypeLabels: Record<string, string> = {
  birth_date: 'Birth Date',
  birth_place: 'Birth Place',
  death_date: 'Death Date',
  death_place: 'Death Place',
  marriage_date: 'Marriage Date',
  marriage_place: 'Marriage Place',
  name: 'Name',
  residence: 'Residence',
  occupation: 'Occupation',
  immigration: 'Immigration',
  military_service: 'Military Service',
  religion: 'Religion',
  ethnicity: 'Ethnicity',
  parent_name: 'Parent Name',
  spouse_name: 'Spouse Name',
  child_name: 'Child Name',
  other: 'Other',
};

function ConflictNodeComponent({ data, selected }: NodeProps<ConflictNodeType>) {
  const info = data.conflictInfo;
  if (!info) return null;

  const label = factTypeLabels[info.factType] ?? info.factType;
  const maxShow = 3;
  const shown = info.values.slice(0, maxShow);
  const remaining = info.values.length - maxShow;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-muted-foreground/40"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-muted-foreground/40"
      />
      <div
        className={`w-[160px] rounded-lg bg-red-50 border border-red-300 shadow-sm transition-all dark:bg-red-950/40 dark:border-red-800 ${
          selected ? 'ring-2 ring-indigo-500 shadow-md' : ''
        }`}
      >
        <div className="p-3 space-y-2 text-center">
          <AlertTriangle className="mx-auto size-5 text-red-500" />
          <p className="text-[12px] font-semibold text-red-800 dark:text-red-300">
            {label}
          </p>
          <div className="space-y-0.5">
            {shown.map((val, i) => (
              <p
                key={i}
                className="text-[11px] text-red-700 dark:text-red-400 truncate"
              >
                {val}
              </p>
            ))}
            {remaining > 0 && (
              <p className="text-[10px] text-red-500 dark:text-red-500">
                +{remaining} more
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export const ConflictNode = memo(ConflictNodeComponent);
