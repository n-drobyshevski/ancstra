import { type Edge, type EdgeProps, getSmoothStepPath, BaseEdge } from '@xyflow/react';

type ParentChildEdgeType = Edge<{ validationStatus: string; familyId: string }, 'parentChild'>;

const statusStyles = {
  confirmed: { strokeDasharray: 'none', stroke: '#6b7280' },
  proposed: { strokeDasharray: '5,5', stroke: '#3b82f6' },
  disputed: { strokeDasharray: '2,4', stroke: '#f59e0b' },
} as const;

export function ParentChildEdge({
  id, sourceX, sourceY, targetX, targetY, data,
}: EdgeProps<ParentChildEdgeType>) {
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, borderRadius: 8 });
  const status = data?.validationStatus ?? 'confirmed';
  const s = statusStyles[status as keyof typeof statusStyles] ?? statusStyles.confirmed;
  return (
    <BaseEdge id={id} path={edgePath} style={{ stroke: s.stroke, strokeWidth: 2, strokeDasharray: s.strokeDasharray }} />
  );
}
