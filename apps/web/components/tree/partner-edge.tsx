import { type Edge, type EdgeProps, getStraightPath, BaseEdge } from '@xyflow/react';

type PartnerEdgeType = Edge<{ familyId: string; pending?: boolean }, 'partner'>;

export function PartnerEdge({
  id, sourceX, sourceY, targetX, targetY, data,
}: EdgeProps<PartnerEdgeType>) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const style = data?.pending
    ? { stroke: 'var(--color-muted-foreground)', strokeWidth: 2, strokeDasharray: '6,4', animation: 'edge-dash-flow 0.5s linear infinite' }
    : { stroke: 'var(--color-muted-foreground)', strokeWidth: 2 };
  return <BaseEdge id={id} path={edgePath} style={style} />;
}
