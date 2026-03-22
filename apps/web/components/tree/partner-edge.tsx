import { type Edge, type EdgeProps, getStraightPath, BaseEdge } from '@xyflow/react';

type PartnerEdgeType = Edge<{ familyId: string }, 'partner'>;

export function PartnerEdge({
  id, sourceX, sourceY, targetX, targetY,
}: EdgeProps<PartnerEdgeType>) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  return <BaseEdge id={id} path={edgePath} style={{ stroke: '#9ca3af', strokeWidth: 2 }} />;
}
