import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

// ---------------------------------------------------------------------------
// Data shapes
// ---------------------------------------------------------------------------

export interface CanvasNodeData extends Record<string, unknown> {
  type: 'research_item' | 'source' | 'note' | 'conflict';
  title: string;
  snippet?: string;
  status?: string;
  confidence?: string;
  conflictInfo?: { factType: string; values: string[] };
  noteText?: string;
  sourceId?: string;
  providerId?: string | null;
}

export interface CanvasPosition {
  id: string;
  personId: string;
  nodeType: string;
  nodeId: string;
  x: number;
  y: number;
}

export interface ResearchItemShape {
  id: string;
  title: string;
  snippet: string | null;
  url: string | null;
  status: string;
  providerId: string | null;
  notes: string | null;
  createdAt: string;
  personIds: string[];
}

export interface ConflictShape {
  factType: string;
  facts: Array<{
    id: string;
    factValue: string;
    confidence: string;
    researchItemId: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Build canvas nodes from research data
// ---------------------------------------------------------------------------

export function buildCanvasNodes(
  researchItems: ResearchItemShape[],
  positions: CanvasPosition[],
  conflicts: ConflictShape[],
): Node<CanvasNodeData>[] {
  const posMap = new Map<string, { x: number; y: number }>();
  for (const p of positions) {
    posMap.set(`${p.nodeType}:${p.nodeId}`, { x: p.x, y: p.y });
  }

  const nodes: Node<CanvasNodeData>[] = [];
  let col = 0;

  // Research items / promoted sources
  for (const item of researchItems) {
    const nodeType = item.status === 'promoted' ? 'source' : 'research_item';
    const key = `${nodeType}:${item.id}`;
    const pos = posMap.get(key) ?? { x: col * 280, y: 0 };
    col++;

    nodes.push({
      id: `${nodeType}-${item.id}`,
      type: 'source',
      position: pos,
      data: {
        type: nodeType,
        title: item.title,
        snippet: item.snippet ?? undefined,
        status: item.status,
        sourceId: item.id,
        providerId: item.providerId,
      },
    });
  }

  // Conflict nodes
  for (const conflict of conflicts) {
    const cId = `conflict-${conflict.factType}`;
    const key = `conflict:${conflict.factType}`;
    const pos = posMap.get(key) ?? { x: col * 280, y: 200 };
    col++;

    nodes.push({
      id: cId,
      type: 'conflict',
      position: pos,
      data: {
        type: 'conflict',
        title: conflict.factType,
        conflictInfo: {
          factType: conflict.factType,
          values: conflict.facts.map((f) => f.factValue),
        },
      },
    });
  }

  // Note nodes come from positions with nodeType='note'
  for (const p of positions) {
    if (p.nodeType === 'note') {
      nodes.push({
        id: `note-${p.nodeId}`,
        type: 'note',
        position: { x: p.x, y: p.y },
        data: {
          type: 'note',
          title: 'Note',
          noteText: '', // loaded from localStorage
        },
      });
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Build conflict edges (auto-generated)
// ---------------------------------------------------------------------------

export function buildConflictEdges(
  conflicts: ConflictShape[],
  researchItems: ResearchItemShape[],
): Edge[] {
  const edges: Edge[] = [];
  const itemIds = new Set(researchItems.map((it) => it.id));

  for (const conflict of conflicts) {
    const cId = `conflict-${conflict.factType}`;
    for (const fact of conflict.facts) {
      if (fact.researchItemId && itemIds.has(fact.researchItemId)) {
        const sourceType =
          researchItems.find((it) => it.id === fact.researchItemId)?.status === 'promoted'
            ? 'source'
            : 'research_item';
        edges.push({
          id: `conflict-edge-${conflict.factType}-${fact.id}`,
          source: `${sourceType}-${fact.researchItemId}`,
          target: cId,
          type: 'evidence',
          data: { relationship: 'contradicts' },
          style: { strokeDasharray: '5,5' },
        });
      }
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Auto-layout via dagre
// ---------------------------------------------------------------------------

export function autoLayoutNodes<T extends Node>(nodes: T[], edges: Edge[]): T[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });

  for (const node of nodes) {
    const w = node.type === 'note' ? 180 : node.type === 'conflict' ? 160 : 220;
    const h = node.type === 'note' ? 120 : node.type === 'conflict' ? 100 : 140;
    g.setNode(node.id, { width: w, height: h });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: { x: pos.x - (pos.width ?? 0) / 2, y: pos.y - (pos.height ?? 0) / 2 },
    } as T;
  });
}

// ---------------------------------------------------------------------------
// Extract positions from current nodes
// ---------------------------------------------------------------------------

export function extractCanvasPositions(
  nodes: Node[],
  personId: string,
): { personId: string; nodeType: string; nodeId: string; x: number; y: number }[] {
  return nodes.map((node) => {
    let nodeType = 'research_item';
    let nodeId = node.id;

    if (node.id.startsWith('source-')) {
      nodeType = 'source';
      nodeId = node.id.replace('source-', '');
    } else if (node.id.startsWith('research_item-')) {
      nodeType = 'research_item';
      nodeId = node.id.replace('research_item-', '');
    } else if (node.id.startsWith('conflict-')) {
      nodeType = 'conflict';
      nodeId = node.id.replace('conflict-', '');
    } else if (node.id.startsWith('note-')) {
      nodeType = 'note';
      nodeId = node.id.replace('note-', '');
    }

    return {
      personId,
      nodeType,
      nodeId,
      x: node.position.x,
      y: node.position.y,
    };
  });
}
