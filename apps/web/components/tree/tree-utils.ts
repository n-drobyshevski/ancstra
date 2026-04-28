import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type {
  PersonListItem,
  TreeData,
} from '@ancstra/shared';
import {
  validateNoSelfRef,
  validateNoDuplicate,
  validateAcyclic,
} from '@/lib/graph/validate-connection';

const NODE_WIDTH = 240;
const NODE_HEIGHT = 70;
const PARTNER_GAP = 40;

const COMPACT_NODE_WIDTH = 120;
const COMPACT_NODE_HEIGHT = 80;
const COMPACT_PARTNER_GAP = 24;

export type NodeStyle = 'wide' | 'compact';

export interface PersonNodeData extends PersonListItem {
  label: string;
  qualityScore?: number;
  missingFields?: string[];
  showGaps?: boolean;
  nodeStyle?: NodeStyle;
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

/** Order a pair so female is left, male is right. Falls back to original order. */
function orderByMotherLeft(a: Node, b: Node): { left: Node; right: Node } {
  const aSex = (a.data as PersonNodeData).sex;
  const bSex = (b.data as PersonNodeData).sex;
  if (aSex === 'M' && bSex === 'F') return { left: b, right: a };
  return { left: a, right: b };
}

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  nodeHeight?: number,
  nodeStyle: NodeStyle = 'wide',
): Node[] {
  if (nodes.length === 0) return nodes;

  const isCompact = nodeStyle === 'compact';
  const width = isCompact ? COMPACT_NODE_WIDTH : NODE_WIDTH;
  const height = nodeHeight ?? (isCompact ? COMPACT_NODE_HEIGHT : NODE_HEIGHT);
  const partnerGap = isCompact ? COMPACT_PARTNER_GAP : PARTNER_GAP;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    ranksep: isCompact ? 100 : 120,
    nodesep: isCompact ? 50 : 80,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width, height });
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
      position: { x: pos.x - width / 2, y: pos.y - height / 2 },
    };
  });

  // Build set of pairs already handled (by partner edges)
  const handledPairs = new Set<string>();

  // Collect all co-parent pairs: partners + parents sharing a child
  const pairs: { left: typeof positioned[0]; right: typeof positioned[0] }[] = [];

  // From partner edges
  const partnerEdges = edges.filter((e) => e.type === 'partner');
  for (const pe of partnerEdges) {
    const a = positioned.find((n) => n.id === pe.source);
    const b = positioned.find((n) => n.id === pe.target);
    if (a && b) {
      const pairKey = [a.id, b.id].sort().join(':');
      if (!handledPairs.has(pairKey)) {
        handledPairs.add(pairKey);
        pairs.push(orderByMotherLeft(a, b));
      }
    }
  }

  // From co-parents (multiple parentChild edges to same child)
  const parentsByChild = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.type === 'parentChild') {
      const parents = parentsByChild.get(edge.target) ?? [];
      parents.push(edge.source);
      parentsByChild.set(edge.target, parents);
    }
  }
  for (const parents of parentsByChild.values()) {
    if (parents.length === 2) {
      const a = positioned.find((n) => n.id === parents[0]);
      const b = positioned.find((n) => n.id === parents[1]);
      if (a && b) {
        const pairKey = [a.id, b.id].sort().join(':');
        if (!handledPairs.has(pairKey)) {
          handledPairs.add(pairKey);
          pairs.push(orderByMotherLeft(a, b));
        }
      }
    }
  }

  // Position each pair side-by-side (mother left, father right)
  for (const { left, right } of pairs) {
    const midX = (left.position.x + right.position.x) / 2;
    const midY = (left.position.y + right.position.y) / 2;
    left.position = { x: midX - (width + partnerGap) / 2, y: midY };
    right.position = { x: midX + (width + partnerGap) / 2, y: midY };
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

export interface LayoutDataV2 {
  positions: Record<string, { x: number; y: number }>;
  nodeStyle?: NodeStyle;
}

/** Parse layoutData JSON — handles legacy flat positions and new v2 format */
export function parseLayoutData(json: string): LayoutDataV2 {
  const raw = JSON.parse(json);

  // New format: has a `positions` key that is an object of {x,y} values
  if (raw.positions && typeof raw.positions === 'object' && !Array.isArray(raw.positions)) {
    return {
      positions: raw.positions,
      nodeStyle: raw.nodeStyle === 'compact' ? 'compact' : undefined,
    };
  }

  // Legacy format: entire object is a positions record
  return { positions: raw };
}

/** Serialize positions to JSON for API storage.
 *
 * Node-style preference is stored separately in localStorage (see
 * `lib/tree/node-style-storage.ts`) and is not part of the layout snapshot —
 * a layout records WHERE nodes are, not HOW the user prefers to view them.
 * `parseLayoutData` still reads a legacy `nodeStyle` field for one-time
 * migration on load. */
export function serializeLayoutData(
  positions: Record<string, { x: number; y: number }>,
): string {
  const data: LayoutDataV2 = { positions };
  return JSON.stringify(data);
}

export function validateConnection(
  treeData: TreeData,
  sourceId: string,
  targetId: string,
  type: 'spouse' | 'parentChild'
): { valid: boolean; error?: string } {
  if (validateNoSelfRef(sourceId, targetId)) {
    return { valid: false, error: 'Cannot connect a person to themselves' };
  }

  const { families, childLinks } = treeData;

  if (type === 'spouse') {
    const dup = validateNoDuplicate(
      sourceId,
      targetId,
      'spouse',
      families,
      (f) => ({
        from: f.partner1Id ?? '',
        to: f.partner2Id ?? '',
        type: 'spouse',
        symmetric: true,
      }),
    );
    if (dup) return { valid: false, error: 'These persons are already spouses' };
  }

  if (type === 'parentChild') {
    for (const cl of childLinks) {
      const fam = families.find((f) => f.id === cl.familyId);
      if (!fam) continue;
      if ((fam.partner1Id === sourceId || fam.partner2Id === sourceId) && cl.personId === targetId) {
        return { valid: false, error: 'This parent-child relationship already exists' };
      }
    }

    // Build parent → child adjacency from existing child links so that a
    // proposed source → target edge creates a cycle iff `source` is already
    // a descendant of `target`.
    const adjacency = new Map<string, Set<string>>();
    for (const cl of childLinks) {
      const fam = families.find((f) => f.id === cl.familyId);
      if (!fam) continue;
      for (const parentId of [fam.partner1Id, fam.partner2Id]) {
        if (!parentId) continue;
        let bucket = adjacency.get(parentId);
        if (!bucket) {
          bucket = new Set();
          adjacency.set(parentId, bucket);
        }
        bucket.add(cl.personId);
      }
    }

    if (validateAcyclic(sourceId, targetId, adjacency, 'parentChild')) {
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
  const dimmedIds = new Set(nodes.filter((n) => (n.data as PersonNodeData)?.dimmed).map((n) => n.id));
  return edges.map((edge) => ({
    ...edge,
    style: {
      ...edge.style,
      opacity: dimmedIds.has(edge.source) || dimmedIds.has(edge.target) ? 0.3 : 1,
    },
  }));
}

export { NODE_WIDTH, NODE_HEIGHT, COMPACT_NODE_WIDTH, COMPACT_NODE_HEIGHT };
