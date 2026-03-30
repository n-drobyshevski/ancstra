import { type Edge, type EdgeProps, getSmoothStepPath, BaseEdge } from '@xyflow/react';

type ParentChildEdgeType = Edge<{ validationStatus: string; familyId: string; pending?: boolean }, 'parentChild'>;

const statusStyles = {
  confirmed: { strokeDasharray: 'none', stroke: 'var(--color-muted-foreground)' },
  proposed: { strokeDasharray: '5,5', stroke: 'var(--color-muted-foreground)' },
  disputed: { strokeDasharray: '2,4', stroke: 'var(--color-muted-foreground)' },
} as const;

export function ParentChildEdge({
  id, sourceX, sourceY, targetX, targetY, data,
}: EdgeProps<ParentChildEdgeType>) {
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, borderRadius: 8 });
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
