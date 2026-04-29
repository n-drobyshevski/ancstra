import { memo } from 'react';
import {
  type Edge,
  type EdgeProps,
  getSmoothStepPath,
  getStraightPath,
  BaseEdge,
} from '@xyflow/react';
import type { EdgeStyle } from '@/lib/tree/view-prefs-storage';

type ParentChildEdgeType = Edge<{
  validationStatus: string;
  familyId: string;
  pending?: boolean;
  pathStyle?: EdgeStyle;
}, 'parentChild'>;

const statusStyles = {
  confirmed: { strokeDasharray: 'none', stroke: 'var(--color-muted-foreground)' },
  proposed: { strokeDasharray: '5,5', stroke: 'var(--color-muted-foreground)' },
  disputed: { strokeDasharray: '2,4', stroke: 'var(--color-muted-foreground)' },
} as const;

interface PathArgs {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

// Switch React Flow path algorithm by user pref. Default ('curved') preserves
// today's look (smoothstep with borderRadius 8) so first paint is unchanged
// for users who haven't touched the menu.
export function getParentChildEdgePath(style: EdgeStyle | undefined, args: PathArgs): string {
  switch (style) {
    case 'straight':
      return getStraightPath(args)[0];
    case 'stepped':
      return getSmoothStepPath({ ...args, borderRadius: 0 })[0];
    case 'curved':
    default:
      return getSmoothStepPath({ ...args, borderRadius: 8 })[0];
  }
}

function ParentChildEdgeComponent({
  id, sourceX, sourceY, targetX, targetY, data,
}: EdgeProps<ParentChildEdgeType>) {
  const edgePath = getParentChildEdgePath(data?.pathStyle, { sourceX, sourceY, targetX, targetY });
  if (data?.pending) {
    return (
      <BaseEdge id={id} path={edgePath} style={{ stroke: 'var(--color-muted-foreground)', strokeWidth: 2, strokeDasharray: '6,4', animation: 'edge-dash-flow 0.5s linear infinite' }} />
    );
  }
  const status = data?.validationStatus ?? 'confirmed';
  const s = statusStyles[status as keyof typeof statusStyles] ?? statusStyles.confirmed;
  return (
    <BaseEdge id={id} path={edgePath} style={{ stroke: s.stroke, strokeWidth: 2, strokeDasharray: s.strokeDasharray }} />
  );
}

export const ParentChildEdge = memo(ParentChildEdgeComponent);
