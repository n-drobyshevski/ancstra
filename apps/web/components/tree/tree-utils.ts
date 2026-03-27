import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type {
  PersonListItem,
  FamilyRecord,
  ChildLink,
  TreeData,
} from '@ancstra/shared';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;
const PARTNER_GAP = 40;

export interface PersonNodeData extends PersonListItem {
  label: string;
  qualityScore?: number;
  missingFields?: string[];
  showGaps?: boolean;
  [key: string]: unknown;
}

export function treeDataToFlow(data: TreeData): {
  nodes: Node[];
  edges: Edge[];
} {
  const { persons, families, childLinks } = data;
  const personMap = new Map(persons.map((p) => [p.id, p]));

  const nodes: Node[] = persons.map((p) => ({
    id: p.id,
    type: 'person',
    position: { x: 0, y: 0 },
    data: {
      ...p,
      label: `${p.givenName} ${p.surname}`,
    } satisfies PersonNodeData,
  }));

  const edges: Edge[] = [];

  // Partner edges (horizontal between spouses)
  for (const fam of families) {
    if (fam.partner1Id && fam.partner2Id) {
      edges.push({
        id: `partner-${fam.id}`,
        type: 'partner',
        source: fam.partner1Id,
        target: fam.partner2Id,
        sourceHandle: 'right',
        targetHandle: 'left',
        data: { familyId: fam.id },
      });
    }
  }

  // Parent-child edges
  for (const cl of childLinks) {
    const family = families.find((f) => f.id === cl.familyId);
    if (!family) continue;

    if (
      family.partner1Id &&
      personMap.has(family.partner1Id) &&
      personMap.has(cl.personId)
    ) {
      edges.push({
        id: `pc-${family.partner1Id}-${cl.personId}`,
        type: 'parentChild',
        source: family.partner1Id,
        target: cl.personId,
        data: {
          validationStatus: cl.validationStatus,
          familyId: cl.familyId,
        },
      });
    }

    if (
      family.partner2Id &&
      !family.partner1Id &&
      personMap.has(family.partner2Id) &&
      personMap.has(cl.personId)
    ) {
      edges.push({
        id: `pc-${family.partner2Id}-${cl.personId}`,
        type: 'parentChild',
        source: family.partner2Id,
        target: cl.personId,
        data: {
          validationStatus: cl.validationStatus,
          familyId: cl.familyId,
        },
      });
    }
  }

  return { nodes, edges };
}

export function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    ranksep: 120,
    nodesep: 80,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    if (edge.type === 'parentChild') {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const positioned = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });

  // Post-layout: adjust partners side-by-side
  const partnerEdges = edges.filter((e) => e.type === 'partner');
  for (const pe of partnerEdges) {
    const sourceNode = positioned.find((n) => n.id === pe.source);
    const targetNode = positioned.find((n) => n.id === pe.target);
    if (sourceNode && targetNode) {
      const midX =
        (sourceNode.position.x + targetNode.position.x) / 2;
      const midY =
        (sourceNode.position.y + targetNode.position.y) / 2;
      sourceNode.position = {
        x: midX - (NODE_WIDTH + PARTNER_GAP) / 2,
        y: midY,
      };
      targetNode.position = {
        x: midX + (NODE_WIDTH + PARTNER_GAP) / 2,
        y: midY,
      };
    }
  }

  return positioned;
}

export function applyPositionMap(
  nodes: Node[],
  positions: Record<string, { x: number; y: number }>,
): Node[] {
  return nodes.map((node) => {
    const stored = positions[node.id];
    if (stored) return { ...node, position: stored };
    return node;
  });
}

export function extractPositions(
  nodes: Node[],
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    if (n.type === 'draftPerson') continue;
    positions[n.id] = { x: n.position.x, y: n.position.y };
  }
  return positions;
}

export function validateConnection(
  treeData: TreeData,
  sourceId: string,
  targetId: string,
  type: 'spouse' | 'parentChild'
): { valid: boolean; error?: string } {
  if (sourceId === targetId) return { valid: false, error: 'Cannot connect a person to themselves' };

  const { families, childLinks } = treeData;

  if (type === 'spouse') {
    const existing = families.some(
      (f) => (f.partner1Id === sourceId && f.partner2Id === targetId) ||
             (f.partner1Id === targetId && f.partner2Id === sourceId)
    );
    if (existing) return { valid: false, error: 'These persons are already spouses' };
  }

  if (type === 'parentChild') {
    for (const cl of childLinks) {
      const fam = families.find((f) => f.id === cl.familyId);
      if (!fam) continue;
      if ((fam.partner1Id === sourceId || fam.partner2Id === sourceId) && cl.personId === targetId) {
        return { valid: false, error: 'This parent-child relationship already exists' };
      }
    }

    function isAncestor(personId: string, ancestorId: string, visited: Set<string>): boolean {
      if (visited.has(personId)) return false;
      visited.add(personId);
      for (const cl of childLinks) {
        if (cl.personId !== personId) continue;
        const fam = families.find((f) => f.id === cl.familyId);
        if (!fam) continue;
        if (fam.partner1Id === ancestorId || fam.partner2Id === ancestorId) return true;
        if (fam.partner1Id && isAncestor(fam.partner1Id, ancestorId, visited)) return true;
        if (fam.partner2Id && isAncestor(fam.partner2Id, ancestorId, visited)) return true;
      }
      return false;
    }

    if (isAncestor(sourceId, targetId, new Set())) {
      return { valid: false, error: 'Cannot create circular relationship' };
    }
  }

  return { valid: true };
}

export interface FilterState {
  sex: { M: boolean; F: boolean; U: boolean };
  living: { living: boolean; deceased: boolean };
}

export const DEFAULT_FILTERS: FilterState = {
  sex: { M: true, F: true, U: true },
  living: { living: true, deceased: true },
};

export function applyFilters(nodes: Node[], filterState: FilterState): Node[] {
  return nodes.map((node) => {
    if (node.type === 'draftPerson') return node;
    const data = node.data as PersonNodeData;
    const sexVisible = filterState.sex[data.sex as 'M' | 'F' | 'U'] ?? true;
    const livingVisible = data.isLiving
      ? filterState.living.living
      : filterState.living.deceased;
    const dimmed = !sexVisible || !livingVisible;
    return { ...node, data: { ...data, dimmed } };
  });
}

export function applyEdgeFilters(edges: Edge[], nodes: Node[]): Edge[] {
  const dimmedIds = new Set(nodes.filter((n) => (n.data as any)?.dimmed).map((n) => n.id));
  return edges.map((edge) => ({
    ...edge,
    style: {
      ...edge.style,
      opacity: dimmedIds.has(edge.source) || dimmedIds.has(edge.target) ? 0.3 : 1,
    },
  }));
}

export { NODE_WIDTH, NODE_HEIGHT };
