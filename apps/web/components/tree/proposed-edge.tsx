import { memo } from 'react';
import { type Edge, type EdgeProps, getSmoothStepPath, BaseEdge } from '@xyflow/react';

type ProposedEdgeType = Edge<{
  relationshipType: 'parent_child' | 'partner' | 'sibling';
  sourceType: string;
  confidence: number | null;
}, 'proposed'>;

// Amber dotted overlay edge for AI/API proposals that have not been validated
// onto the canonical tree. Lower opacity + dotted stroke distinguish them from
// confirmed edges. Reuses the existing `edge-dash-flow` keyframes for motion.
function ProposedEdgeComponent({
  id, sourceX, sourceY, targetX, targetY,
}: EdgeProps<ProposedEdgeType>) {
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, borderRadius: 8 });
  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: '#d97706',
        strokeWidth: 2,
        strokeDasharray: '2,4',
        opacity: 0.7,
        animation: 'edge-dash-flow 0.8s linear infinite',
      }}
    />
  );
}

export const ProposedEdge = memo(ProposedEdgeComponent);
