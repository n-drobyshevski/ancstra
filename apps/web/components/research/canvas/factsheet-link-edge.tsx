// apps/web/components/research/canvas/factsheet-link-edge.tsx
import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';

interface FactsheetLinkEdgeData extends Record<string, unknown> {
  relationshipType: string;
  linkId: string;
}

type FactsheetLinkEdgeType = Edge<FactsheetLinkEdgeData, 'factsheetLink'>;

function FactsheetLinkEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  label,
}: EdgeProps<FactsheetLinkEdgeType>) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-[8px] text-muted-foreground bg-background/80 px-1 rounded pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const FactsheetLinkEdge = memo(FactsheetLinkEdgeComponent);
