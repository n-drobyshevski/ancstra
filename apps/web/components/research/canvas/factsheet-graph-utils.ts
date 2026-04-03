// apps/web/components/research/canvas/factsheet-graph-utils.ts
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type {
  Factsheet,
  FactsheetFact,
  FactsheetLink,
  FactsheetDetail,
} from '@/lib/research/factsheet-client';

// ---- Cluster View types ----

export interface FactsheetNodeData extends Record<string, unknown> {
  factsheet: Factsheet;
  factCount: number;
  linkCount: number;
  missingFields: string[];
}

export interface ClusterBoundary {
  factsheetIds: string[];
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
}

// ---- Evidence View types ----

export interface FactNodeData extends Record<string, unknown> {
  fact: FactsheetFact;
  hasConflict: boolean;
}

export interface SourceResearchNodeData extends Record<string, unknown> {
  researchItemId: string;
  title: string;
  provider: string | null;
}

export interface CenterFactsheetNodeData extends Record<string, unknown> {
  factsheet: Factsheet;
  factCount: number;
}

// ---- Constants ----

const FACTSHEET_NODE_WIDTH = 160;
const FACTSHEET_NODE_HEIGHT = 80;
const FACT_NODE_WIDTH = 130;
const FACT_NODE_HEIGHT = 70;
const SOURCE_NODE_WIDTH = 110;
const SOURCE_NODE_HEIGHT = 50;
const CENTER_NODE_WIDTH = 160;
const CENTER_NODE_HEIGHT = 60;

// ---- Edge style configs ----

export const LINK_EDGE_STYLES: Record<string, { stroke: string; strokeDasharray?: string; strokeWidth: number }> = {
  parent_child: { stroke: '#4f6bed', strokeWidth: 2 },
  spouse: { stroke: '#9ca3af', strokeDasharray: '4,3', strokeWidth: 1.5 },
  sibling: { stroke: '#d4d4d8', strokeDasharray: '2,2', strokeWidth: 1 },
};

export const LINK_LABELS: Record<string, string> = {
  parent_child: 'parent',
  spouse: 'spouse',
  sibling: 'sibling',
};

// ---- Cluster View builders ----

export function buildClusterNodes(
  factsheets: Factsheet[],
  allLinks: FactsheetLink[],
  factCounts: Map<string, number>,
): Node<FactsheetNodeData>[] {
  return factsheets.map((fs) => {
    const linkCount = allLinks.filter(
      (l) => l.fromFactsheetId === fs.id || l.toFactsheetId === fs.id,
    ).length;

    return {
      id: fs.id,
      type: 'factsheetNode',
      position: { x: 0, y: 0 },
      data: {
        factsheet: fs,
        factCount: factCounts.get(fs.id) ?? 0,
        linkCount,
        missingFields: [], // computed later if needed
      },
    };
  });
}

export function buildClusterEdges(links: FactsheetLink[]): Edge[] {
  return links.map((link) => {
    const style = LINK_EDGE_STYLES[link.relationshipType] ?? LINK_EDGE_STYLES.parent_child;
    return {
      id: `link-${link.id}`,
      source: link.fromFactsheetId,
      target: link.toFactsheetId,
      type: 'factsheetLink',
      data: { relationshipType: link.relationshipType, linkId: link.id },
      style,
      label: LINK_LABELS[link.relationshipType] ?? '',
      labelStyle: { fontSize: 10, fill: '#94a3b8' },
    };
  });
}

export function layoutClusterNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 60, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    g.setNode(node.id, { width: FACTSHEET_NODE_WIDTH, height: FACTSHEET_NODE_HEIGHT });
  }

  for (const edge of edges) {
    // Only use parent_child edges for hierarchical layout
    if ((edge.data as { relationshipType?: string })?.relationshipType === 'parent_child') {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: { x: pos.x - FACTSHEET_NODE_WIDTH / 2, y: pos.y - FACTSHEET_NODE_HEIGHT / 2 },
    };
  });
}

/**
 * Detect clusters via BFS on links. Returns array of connected component ID sets.
 */
export function detectClusters(
  factsheetIds: string[],
  links: FactsheetLink[],
): string[][] {
  const adj = new Map<string, Set<string>>();
  for (const id of factsheetIds) adj.set(id, new Set());
  for (const link of links) {
    adj.get(link.fromFactsheetId)?.add(link.toFactsheetId);
    adj.get(link.toFactsheetId)?.add(link.fromFactsheetId);
  }

  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const id of factsheetIds) {
    if (visited.has(id)) continue;
    const component: string[] = [];
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      component.push(cur);
      for (const neighbor of adj.get(cur) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    if (component.length > 1) clusters.push(component);
  }

  return clusters;
}

/**
 * Compute bounding rectangles for clusters (after layout).
 */
export function computeClusterBounds(
  clusters: string[][],
  nodes: Node[],
): ClusterBoundary[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const PADDING = 24;

  return clusters.map((ids, i) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids) {
      const node = nodeMap.get(id);
      if (!node) continue;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + FACTSHEET_NODE_WIDTH);
      maxY = Math.max(maxY, node.position.y + FACTSHEET_NODE_HEIGHT);
    }
    return {
      factsheetIds: ids,
      label: `Family Unit ${i + 1}`,
      bounds: {
        x: minX - PADDING,
        y: minY - PADDING - 16, // extra space for label
        width: maxX - minX + PADDING * 2,
        height: maxY - minY + PADDING * 2 + 16,
      },
    };
  });
}

// ---- Evidence View builders ----

export function buildEvidenceNodes(
  factsheet: FactsheetDetail,
  researchItems: Map<string, { title: string; provider: string | null }>,
  conflictFactIds: Set<string>,
): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Center factsheet node
  nodes.push({
    id: `center-${factsheet.id}`,
    type: 'centerFactsheet',
    position: { x: 0, y: 0 },
    data: {
      factsheet,
      factCount: factsheet.facts.length,
    } satisfies CenterFactsheetNodeData,
  });

  // Fact nodes
  for (const fact of factsheet.facts) {
    const nodeId = `fact-${fact.id}`;
    nodes.push({
      id: nodeId,
      type: 'factNode',
      position: { x: 0, y: 0 },
      data: {
        fact,
        hasConflict: conflictFactIds.has(fact.id),
      } satisfies FactNodeData,
    });

    // Edge: center → fact
    edges.push({
      id: `edge-center-${fact.id}`,
      source: `center-${factsheet.id}`,
      target: nodeId,
      style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
    });

    // Source node if fact has a research item
    if (fact.researchItemId) {
      const sourceNodeId = `source-${fact.researchItemId}`;
      const item = researchItems.get(fact.researchItemId);
      if (item && !nodes.some((n) => n.id === sourceNodeId)) {
        nodes.push({
          id: sourceNodeId,
          type: 'sourceResearchNode',
          position: { x: 0, y: 0 },
          data: {
            researchItemId: fact.researchItemId,
            title: item.title,
            provider: item.provider,
          } satisfies SourceResearchNodeData,
        });
      }

      // Edge: source → fact
      edges.push({
        id: `edge-source-${fact.researchItemId}-${fact.id}`,
        source: sourceNodeId,
        target: nodeId,
        style: { stroke: '#fbbf24', strokeWidth: 1, strokeDasharray: '3,2' },
      });
    }
  }

  return { nodes, edges };
}

export function layoutEvidenceNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 40, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    let w = FACT_NODE_WIDTH;
    let h = FACT_NODE_HEIGHT;
    if (node.type === 'centerFactsheet') { w = CENTER_NODE_WIDTH; h = CENTER_NODE_HEIGHT; }
    if (node.type === 'sourceResearchNode') { w = SOURCE_NODE_WIDTH; h = SOURCE_NODE_HEIGHT; }
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
    };
  });
}
