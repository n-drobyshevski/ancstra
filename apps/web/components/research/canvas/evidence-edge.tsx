'use client';

import { memo } from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';

export interface EvidenceEdgeData extends Record<string, unknown> {
  relationship?: 'supports' | 'contradicts' | 'related' | 'derived_from';
}

type EvidenceEdgeType = Edge<EvidenceEdgeData, 'evidence'>;

const relationshipColors: Record<string, string> = {
  supports: '#22c55e',
  contradicts: '#ef4444',
  related: '#9ca3af',
  derived_from: '#6366f1',
};

const relationshipLabels: Record<string, string> = {
  supports: 'supports',
  contradicts: 'contradicts',
  related: 'related',
  derived_from: 'derived from',
};

function EvidenceEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style,
}: EdgeProps<EvidenceEdgeType>) {
  const relationship = data?.relationship ?? 'related';
  const color = relationshipColors[relationship] ?? '#9ca3af';
  const label = relationshipLabels[relationship] ?? relationship;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={style?.strokeDasharray as string | undefined}
        className="react-flow__edge-path transition-all"
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium border transition-colors ${
            selected
              ? 'bg-card border-indigo-400 text-foreground'
              : 'bg-card/80 border-border text-muted-foreground'
          }`}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const EvidenceEdge = memo(EvidenceEdgeComponent);
