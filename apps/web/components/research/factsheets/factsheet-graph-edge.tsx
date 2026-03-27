'use client';

import { memo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import { RELATIONSHIP_TYPE_LABELS } from '@/lib/research/constants';

const STROKE_STYLES: Record<string, string> = {
  spouse: '4',
  parent_child: '0',
  sibling: '2 2',
};

function FactsheetGraphEdgeInner({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const relType = (data?.relationshipType as string) ?? 'parent_child';
  const label = RELATIONSHIP_TYPE_LABELS[relType] ?? relType;
  const dashArray = STROKE_STYLES[relType] ?? '0';

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: dashArray }} />
      <foreignObject x={labelX - 20} y={labelY - 8} width={40} height={16} className="pointer-events-none">
        <div className="flex items-center justify-center rounded border border-border bg-background px-1 text-[9px] text-muted-foreground">
          {label}
        </div>
      </foreignObject>
    </>
  );
}

export const FactsheetGraphEdge = memo(FactsheetGraphEdgeInner);
