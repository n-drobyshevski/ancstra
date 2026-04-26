'use client';

import { memo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

function FactsheetGraphEdgeInner({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const isPending = data?.pending === true;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: '#94a3b8',
        strokeWidth: 2,
        strokeDasharray: isPending ? '4 2' : undefined,
        opacity: isPending ? 0.6 : 1,
      }}
    />
  );
}

export const FactsheetGraphEdge = memo(FactsheetGraphEdgeInner);
