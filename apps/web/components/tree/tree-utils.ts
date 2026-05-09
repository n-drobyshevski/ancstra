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
import type { ColorTone } from '@/lib/tree/coloring';
import type { ColoringStyle } from '@/lib/tree/view-prefs-storage';

const NODE_WIDTH = 240;
const NODE_HEIGHT = 70;
const PARTNER_GAP = 40;

const COMPACT_NODE_WIDTH = 120;
const COMPACT_NODE_HEIGHT = 80;
const COMPACT_PARTNER_GAP = 24;

export type NodeStyle = 'wide' | 'compact';

/** Toggleable layout behaviors. Defaults match the user-preferences DB
 * defaults: genealogical ordering ON. Off restores legacy insertion-order
 * behavior; the existing `orderByMotherLeft` partner-pair swap still runs
 * unconditionally because it's a single-pair guarantee, not a layout policy. */
export interface LayoutOpts {
  genealogicalOrdering?: boolean;
}

const DEFAULT_LAYOUT_OPTS: Required<LayoutOpts> = {
  genealogicalOrdering: true,
};

export interface PersonNodeData extends PersonListItem {
  label: string;
  qualityScore?: number;
  missingFields?: string[];
  showGaps?: boolean;
  nodeStyle?: NodeStyle;
  showDates?: boolean;
  showLivingIndicator?: boolean;
  showCitations?: boolean;
  coloringTone?: ColorTone;
  coloringStyle?: ColoringStyle;
  [key: string]: unknown;
}

/** Extract a numeric year-month-day key from a (possibly fuzzy) ISO date string.
 * Returns Infinity for null / unparseable values so undated rows sort to the end.
 * Strict ISO ("1880-03-12", "1880") parses; "about 1880" falls back to first
 * 4-digit year occurrence. */
function parseYearForSort(birthDate: string | null | undefined): number {
  if (!birthDate) return Number.POSITIVE_INFINITY;
  const t = Date.parse(birthDate);
  if (!Number.isNaN(t)) return t;
  const m = birthDate.match(/(\d{4})/);
  if (m) {
    // Treat "about 1880" as Jan 1 1880 for ordering purposes only.
    const yr = Number.parseInt(m[1], 10);
    return Date.UTC(yr, 0, 1);
  }
  return Number.POSITIVE_INFINITY;
}

/** Compare two child-link entries for stable left-to-right sibling order:
 * birthDate asc → childOrder asc → original array index. */
function compareChildLinks(
  a: { birthKey: number; childOrder: number; idx: number },
  b: { birthKey: number; childOrder: number; idx: number },
): number {
  if (a.birthKey !== b.birthKey) return a.birthKey - b.birthKey;
  if (a.childOrder !== b.childOrder) return a.childOrder - b.childOrder;
  return a.idx - b.idx;
}

/** F before M before U. Stable for identical sex. */
function sexRank(sex: 'M' | 'F' | 'U' | undefined): number {
  if (sex === 'F') return 0;
  if (sex === 'M') return 2;
  return 1;
}

export function treeDataToFlow(
  data: TreeData,
  opts?: LayoutOpts,
): {
  nodes: Node[];
  edges: Edge[];
} {
  const { persons, families, childLinks } = data;
  const { genealogicalOrdering } = { ...DEFAULT_LAYOUT_OPTS, ...opts };
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
      let source = fam.partner1Id;
      let target = fam.partner2Id;
      if (genealogicalOrdering) {
        const p1 = personMap.get(fam.partner1Id);
        const p2 = personMap.get(fam.partner2Id);
        if (p1 && p2 && sexRank(p2.sex) < sexRank(p1.sex)) {
          source = fam.partner2Id;
          target = fam.partner1Id;
        }
      }
      edges.push({
        id: `partner-${fam.id}`,
        type: 'partner',
        source,
        target,
        sourceHandle: 'right',
        targetHandle: 'left',
        data: { familyId: fam.id },
      });
    }
  }

  // Parent-child edges. With genealogical ordering on: group by family, sort
  // siblings eldest-first, and emit mother→child before father→child.
  const orderedLinks = genealogicalOrdering
    ? sortChildLinksForEmission(childLinks, personMap)
    : childLinks;

  for (const cl of orderedLinks) {
    const family = families.find((f) => f.id === cl.familyId);
    if (!family) continue;

    const p1 = family.partner1Id;
    const p2 = family.partner2Id;
    let parentIds: (string | null | undefined)[] = [p1, p2];

    if (genealogicalOrdering && p1 && p2) {
      // Mother-edge first → seeds Dagre's barycenter toward mother-left.
      const persons1 = personMap.get(p1);
      const persons2 = personMap.get(p2);
      if (persons1 && persons2 && sexRank(persons2.sex) < sexRank(persons1.sex)) {
        parentIds = [p2, p1];
      }
    }

    // Legacy semantics: when both partners exist, the canonical edge is from
    // partner1 only — partner-pair tightening collapses the pair to share the
    // child position. When only partner2 exists, emit from partner2.
    // We preserve that behavior here: only emit ONE parent→child edge per
    // child unless this is a single-parent family.
    const hasPartner1 = !!p1 && personMap.has(p1);
    const hasPartner2 = !!p2 && personMap.has(p2);
    const childExists = personMap.has(cl.personId);
    if (!childExists) continue;

    let primaryParent: string | undefined;
    if (genealogicalOrdering && hasPartner1 && hasPartner2) {
      primaryParent = parentIds[0] as string;
    } else if (hasPartner1) {
      primaryParent = p1!;
    } else if (hasPartner2) {
      primaryParent = p2!;
    }
    if (!primaryParent) continue;

    edges.push({
      id: `pc-${primaryParent}-${cl.personId}`,
      type: 'parentChild',
      source: primaryParent,
      target: cl.personId,
      data: {
        validationStatus: cl.validationStatus,
        familyId: cl.familyId,
      },
    });
  }

  return { nodes, edges };
}

/** Stable global re-order of childLinks: group by familyId, sort each group
 * by birth date ASC (then childOrder, then original idx), preserve family
 * encounter order across groups. */
function sortChildLinksForEmission(
  childLinks: TreeData['childLinks'],
  personMap: Map<string, PersonListItem>,
): TreeData['childLinks'] {
  type Entry = {
    cl: TreeData['childLinks'][number];
    sortKey: { birthKey: number; childOrder: number; idx: number };
  };
  const groups = new Map<string, Entry[]>();
  const familyOrder: string[] = [];
  childLinks.forEach((cl, idx) => {
    if (!groups.has(cl.familyId)) {
      groups.set(cl.familyId, []);
      familyOrder.push(cl.familyId);
    }
    const person = personMap.get(cl.personId);
    groups.get(cl.familyId)!.push({
      cl,
      sortKey: {
        birthKey: parseYearForSort(person?.birthDate),
        childOrder: cl.childOrder ?? Number.POSITIVE_INFINITY,
        idx,
      },
    });
  });

  const out: TreeData['childLinks'] = [];
  for (const famId of familyOrder) {
    const group = groups.get(famId)!;
    group.sort((a, b) => compareChildLinks(a.sortKey, b.sortKey));
    for (const g of group) out.push(g.cl);
  }
  return out;
}

/** Order a pair so female is left, male is right. Falls back to original order. */
function orderByMotherLeft(a: Node, b: Node): { left: Node; right: Node } {
  const aSex = (a.data as PersonNodeData).sex;
  const bSex = (b.data as PersonNodeData).sex;
  if (aSex === 'M' && bSex === 'F') return { left: b, right: a };
  return { left: a, right: b };
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

/** Returns the set of unordered pair keys (`[a, b].sort().join(':')`) for every
 * partner pair in the graph: explicit partner edges + parents sharing a child. */
function collectPartnerPairKeys(edges: Edge[], nodeIds: Set<string>): Set<string> {
  const keys = new Set<string>();

  for (const e of edges) {
    if (e.type === 'partner' && nodeIds.has(e.source) && nodeIds.has(e.target)) {
      keys.add(pairKey(e.source, e.target));
    }
  }

  const parentsByChild = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type === 'parentChild') {
      const list = parentsByChild.get(e.target) ?? [];
      list.push(e.source);
      parentsByChild.set(e.target, list);
    }
  }
  for (const parents of parentsByChild.values()) {
    if (parents.length === 2 && nodeIds.has(parents[0]) && nodeIds.has(parents[1])) {
      keys.add(pairKey(parents[0], parents[1]));
    }
  }

  return keys;
}

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  nodeHeight?: number,
  nodeStyle: NodeStyle = 'wide',
  opts?: LayoutOpts,
): Node[] {
  if (nodes.length === 0) return nodes;

  const { genealogicalOrdering } = { ...DEFAULT_LAYOUT_OPTS, ...opts };

  const isCompact = nodeStyle === 'compact';
  const width = isCompact ? COMPACT_NODE_WIDTH : NODE_WIDTH;
  const height = nodeHeight ?? (isCompact ? COMPACT_NODE_HEIGHT : NODE_HEIGHT);
  const partnerGap = isCompact ? COMPACT_PARTNER_GAP : PARTNER_GAP;
  const nodesep = isCompact ? 50 : 80;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    ranksep: isCompact ? 100 : 120,
    nodesep,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width, height });
  }

  // When genealogical ordering is on, also feed Dagre "ghost" parent→child
  // edges from any spouse who isn't the canonical (visible) parent. This
  // anchors both grandparents at the rank above their grandchild so paternal
  // and maternal sub-trees occupy distinct horizontal regions instead of
  // intermixing. Without this, the non-canonical spouse is an orphan in
  // Dagre's view and gets placed arbitrarily.
  const dagreEdgeKeys = new Set<string>();
  const setDagreEdge = (src: string, tgt: string) => {
    const k = `${src} ${tgt}`;
    if (dagreEdgeKeys.has(k)) return;
    dagreEdgeKeys.add(k);
    g.setEdge(src, tgt);
  };

  let partnersForGhost: Map<string, Set<string>> | null = null;
  if (genealogicalOrdering) {
    partnersForGhost = new Map();
    const nodeIds = new Set(nodes.map((n) => n.id));
    const partnerPairs = collectPartnerPairKeys(edges, nodeIds);
    for (const key of partnerPairs) {
      const [a, b] = key.split(':');
      if (!partnersForGhost.has(a)) partnersForGhost.set(a, new Set());
      if (!partnersForGhost.has(b)) partnersForGhost.set(b, new Set());
      partnersForGhost.get(a)!.add(b);
      partnersForGhost.get(b)!.add(a);
    }
  }

  for (const edge of edges) {
    if (edge.type === 'parentChild') {
      setDagreEdge(edge.source, edge.target);
      if (partnersForGhost) {
        const partners = partnersForGhost.get(edge.source);
        if (partners) {
          for (const partnerId of partners) {
            setDagreEdge(partnerId, edge.target);
          }
        }
      }
    }
  }

  dagre.layout(g);

  let positioned: Node[] = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - width / 2, y: pos.y - height / 2 },
    };
  });

  // Genealogical reorder pass replaces both the per-rank sibling sort AND the
  // partner-pair tightening loop. It walks ranks bottom-up so each pair's
  // anchor is the average X of their already-placed children, naturally
  // propagating "father's branch trends right" up the tree.
  if (genealogicalOrdering) {
    positioned = reorderByGenealogy(positioned, edges, width, partnerGap, nodesep);
    return positioned;
  }

  // Legacy path (toggle off): position each pair side-by-side (mother left,
  // father right). Uses the shared partner-pair detection helper so this list
  // stays in sync with `relaxOverlapsByRank`.
  const nodeIdSet = new Set(positioned.map((n) => n.id));
  const partnerKeys = collectPartnerPairKeys(edges, nodeIdSet);
  const byId = new Map(positioned.map((n) => [n.id, n] as const));
  for (const key of partnerKeys) {
    const [aId, bId] = key.split(':');
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a || !b) continue;
    const { left, right } = orderByMotherLeft(a, b);
    const midX = (left.position.x + right.position.x) / 2;
    const midY = (left.position.y + right.position.y) / 2;
    left.position = { x: midX - (width + partnerGap) / 2, y: midY };
    right.position = { x: midX + (width + partnerGap) / 2, y: midY };
  }

  return positioned;
}

/**
 * Per-rank reorder pass. Walks ranks BOTTOM-UP so each partner pair anchors
 * to the average X of its already-positioned children at the rank below.
 * That naturally propagates "father's branch trends right" up the tree:
 *   - Mid rank: mother sits left of children's anchor, father sits right.
 *   - Top rank: paternal grandparents anchor to father (now on the right);
 *     maternal grandparents anchor to mother (on the left).
 *
 * Sibling ordering within each parent-pair group is read from the
 * `parentChild` edge insertion order — `treeDataToFlow` pre-sorts those
 * edges by birthDate → childOrder → original index when ordering is on, so
 * downstream callers see a single consistent order.
 *
 * Y is preserved (Dagre owns vertical spacing). Pure: returns a new
 * Node[]; does not mutate input.
 */
function reorderByGenealogy(
  nodes: Node[],
  edges: Edge[],
  width: number,
  partnerGap: number,
  nodesep: number,
): Node[] {
  const Y_TOLERANCE = 5;
  const personNodes = nodes.filter((n) => n.type === 'person');
  if (personNodes.length === 0) return nodes;

  // --- Group by rank (top to bottom: rank 0 = oldest ancestors) ---
  const sortedByY = [...personNodes].sort((a, b) => a.position.y - b.position.y);
  const ranks: Node[][] = [];
  let currentRank: Node[] = [];
  let anchorY = Number.NEGATIVE_INFINITY;
  for (const n of sortedByY) {
    if (currentRank.length === 0 || Math.abs(n.position.y - anchorY) <= Y_TOLERANCE) {
      if (currentRank.length === 0) anchorY = n.position.y;
      currentRank.push(n);
    } else {
      ranks.push(currentRank);
      currentRank = [n];
      anchorY = n.position.y;
    }
  }
  if (currentRank.length > 0) ranks.push(currentRank);

  // --- Adjacency from edges ---
  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type === 'parentChild') {
      const ps = parentsByChild.get(e.target) ?? [];
      ps.push(e.source);
      parentsByChild.set(e.target, ps);
      const cs = childrenByParent.get(e.source) ?? [];
      cs.push(e.target);
      childrenByParent.set(e.source, cs);
    }
  }

  const personIdSet = new Set(personNodes.map((n) => n.id));
  const partnerKeys = collectPartnerPairKeys(edges, personIdSet);
  const partnerOf = new Map<string, Set<string>>();
  for (const key of partnerKeys) {
    const [a, b] = key.split(':');
    if (!partnerOf.has(a)) partnerOf.set(a, new Set());
    if (!partnerOf.has(b)) partnerOf.set(b, new Set());
    partnerOf.get(a)!.add(b);
    partnerOf.get(b)!.add(a);
  }

  // Emission rank: position of each child's canonical parentChild edge in
  // the edges array. Encodes the sibling sort key from `treeDataToFlow`
  // (birthDate → childOrder → idx). Lower = earlier-emitted = leftmost.
  const emissionRank = new Map<string, number>();
  let emIdx = 0;
  for (const e of edges) {
    if (e.type === 'parentChild' && !emissionRank.has(e.target)) {
      emissionRank.set(e.target, emIdx);
      emIdx += 1;
    }
  }

  /** Group siblings by their parent-pair (or single parent). Top-rank
   * orphans get a unique key per node so each is its own group. */
  const parentGroupKey = (childId: string): string => {
    const ps = parentsByChild.get(childId);
    if (!ps || ps.length === 0) return `orphan:${childId}`;
    if (ps.length === 1) {
      const p1 = ps[0];
      const partners = partnerOf.get(p1);
      const partner =
        partners && partners.size === 1 ? Array.from(partners)[0] : null;
      return partner ? pairKey(p1, partner) : `single:${p1}`;
    }
    return pairKey(ps[0], ps[1]);
  };

  // nextX accumulates the new X per node; defaults to current Dagre X.
  const nextX = new Map<string, number>();
  for (const n of personNodes) nextX.set(n.id, n.position.x);

  // --- Bottom-up rank pass ---
  for (let r = ranks.length - 1; r >= 0; r -= 1) {
    const rank = ranks[r];
    const inRank = new Set(rank.map((n) => n.id));

    // STEP A: within each sibling group, order by emission rank (which
    // already encodes birthDate + childOrder + idx); fall back to current X.
    const byGroup = new Map<string, Node[]>();
    for (const node of rank) {
      const key = parentGroupKey(node.id);
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(node);
    }
    for (const group of byGroup.values()) {
      group.sort((a, b) => {
        const ra = emissionRank.get(a.id) ?? Number.POSITIVE_INFINITY;
        const rb = emissionRank.get(b.id) ?? Number.POSITIVE_INFINITY;
        if (ra !== rb) return ra - rb;
        return (nextX.get(a.id) ?? 0) - (nextX.get(b.id) ?? 0);
      });
    }

    // STEP B: within each multi-sibling group, re-space around the group's
    // current center using a fixed stride (width + nodesep). This snaps
    // siblings into the genealogical order regardless of Dagre's choice.
    for (const group of byGroup.values()) {
      if (group.length <= 1) continue;
      const center =
        group.reduce((s, n) => s + (nextX.get(n.id) ?? 0), 0) / group.length;
      const stride = width + nodesep;
      const startX = center - (stride * (group.length - 1)) / 2;
      group.forEach((n, idx) => {
        nextX.set(n.id, startX + stride * idx);
      });
    }

    // STEP C: anchor each partner pair at this rank to the average X of
    // their shared children at rank+1 (already placed by previous bottom-up
    // iteration). Mother gets the left slot, father the right.
    const seen = new Set<string>();
    for (const node of rank) {
      if (seen.has(node.id)) continue;
      const partners = partnerOf.get(node.id);
      if (!partners) continue;

      // Pick a partner that is also at THIS rank.
      let partnerId: string | null = null;
      for (const pid of partners) {
        if (inRank.has(pid)) {
          partnerId = pid;
          break;
        }
      }
      if (!partnerId) continue;
      seen.add(node.id);
      seen.add(partnerId);

      // Children of this pair = union of each partner's canonical children
      // (treeDataToFlow emits a single canonical parent→child edge per child;
      // a partnered pair shares ALL their canonical children).
      const aKids = childrenByParent.get(node.id) ?? [];
      const bKids = childrenByParent.get(partnerId) ?? [];
      const sharedKids = Array.from(new Set([...aKids, ...bKids])).filter((c) =>
        nextX.has(c),
      );

      let anchor: number;
      if (sharedKids.length > 0) {
        const xs = sharedKids.map((c) => nextX.get(c)!);
        anchor = xs.reduce((a, b) => a + b, 0) / xs.length;
      } else {
        // No children-in-view: keep the pair's current midpoint.
        anchor = ((nextX.get(node.id) ?? 0) + (nextX.get(partnerId) ?? 0)) / 2;
      }

      // Decide mother vs father.
      const aSex = (rank.find((n) => n.id === node.id)!.data as PersonNodeData).sex;
      const bSex = (rank.find((n) => n.id === partnerId)!.data as PersonNodeData).sex;
      let momId: string;
      let dadId: string;
      if (aSex === 'F' && bSex !== 'F') {
        momId = node.id;
        dadId = partnerId;
      } else if (bSex === 'F' && aSex !== 'F') {
        momId = partnerId;
        dadId = node.id;
      } else if (aSex === 'M' && bSex !== 'M') {
        momId = partnerId;
        dadId = node.id;
      } else if (bSex === 'M' && aSex !== 'M') {
        momId = node.id;
        dadId = partnerId;
      } else {
        // Both U or both same — preserve current order.
        if ((nextX.get(node.id) ?? 0) <= (nextX.get(partnerId) ?? 0)) {
          momId = node.id;
          dadId = partnerId;
        } else {
          momId = partnerId;
          dadId = node.id;
        }
      }

      // Tighten the pair to a partnerGap visual unless an ancestor PAIR
      // (a co-parent couple) sits above either partner. A solo ancestor
      // (single grandparent with no spouse in view) doesn't need horizontal
      // room — STEP D below anchors them to follow the descendant, so the
      // pair below can stay tight. Two side-by-side grandparent cards DO
      // need room, so we leave Dagre's spread intact in that case.
      const hasAncestorPair = (parentId: string): boolean => {
        const ps = parentsByChild.get(parentId) ?? [];
        if (ps.length >= 2) return true;
        if (ps.length === 1) {
          const grandparentPartners = partnerOf.get(ps[0]);
          if (grandparentPartners && grandparentPartners.size > 0) return true;
        }
        return false;
      };
      const tighten = !hasAncestorPair(momId) && !hasAncestorPair(dadId);

      if (tighten) {
        nextX.set(momId, anchor - (width + partnerGap) / 2);
        nextX.set(dadId, anchor + (width + partnerGap) / 2);
      } else {
        const momX = nextX.get(momId) ?? 0;
        const dadX = nextX.get(dadId) ?? 0;
        if (momX > dadX) {
          nextX.set(momId, dadX);
          nextX.set(dadId, momX);
        }
      }
    }

    // STEP D: anchor singleton parents (not part of any partner pair at this
    // rank) to the average X of their children at the rank below. Without
    // this, an only-parent ancestor like a paternal grandfather (whose son's
    // position changed via STEP C) keeps Dagre's stale X and ends up far
    // from the child it's connected to.
    for (const node of rank) {
      if (seen.has(node.id)) continue;
      const kids = childrenByParent.get(node.id);
      if (!kids || kids.length === 0) continue;
      const xs = kids
        .map((c) => nextX.get(c))
        .filter((v): v is number => v !== undefined);
      if (xs.length === 0) continue;
      const childAvg = xs.reduce((a, b) => a + b, 0) / xs.length;
      nextX.set(node.id, childAvg);
    }
  }

  // Apply nextX → return new node array.
  return nodes.map((n) => {
    const x = nextX.get(n.id);
    if (x === undefined || x === n.position.x) return n;
    return { ...n, position: { x, y: n.position.y } };
  });
}

/**
 * Per-rank linear relaxation that nudges overlapping nodes apart on the X axis.
 *
 * Use case: when the user switches node-style mode (compact ↔ wide), CSS card
 * width changes (120 ↔ 240 px) but Dagre layout is not recomputed — sibling
 * cards positioned for the old width can overlap. This function does a single
 * left-to-right pass per rank, pushing only nodes that actually conflict (and
 * cascading later siblings to preserve relative order). It is a no-op when no
 * overlaps exist.
 *
 * Y is grouped with a small tolerance so manually-dragged nodes that drifted
 * a few pixels off rank still get treated as same-generation.
 *
 * Pure: returns a new `Node[]`; does not mutate input.
 */
export function relaxOverlapsByRank(
  nodes: Node[],
  edges: Edge[],
  nodeStyle: NodeStyle,
): Node[] {
  if (nodes.length === 0) return nodes;

  const isCompact = nodeStyle === 'compact';
  const width = isCompact ? COMPACT_NODE_WIDTH : NODE_WIDTH;
  const partnerGap = isCompact ? COMPACT_PARTNER_GAP : PARTNER_GAP;
  const minHorizontalGap = isCompact ? 50 : 80; // matches Dagre's `nodesep`

  const Y_TOLERANCE = 5;

  // Only consider person nodes for relaxation. Drafts/pending nodes are
  // user-driven placements and should stay where the user put them.
  const personNodes = nodes.filter((n) => n.type === 'person');
  if (personNodes.length === 0) return nodes;

  const nodeIdSet = new Set(personNodes.map((n) => n.id));
  const partnerKeys = collectPartnerPairKeys(edges, nodeIdSet);

  // Group by rank. We anchor each new rank to the first node we encounter in
  // sort order, then absorb anything within Y_TOLERANCE of that anchor.
  const sortedByY = [...personNodes].sort((a, b) => a.position.y - b.position.y);
  const ranks: Node[][] = [];
  let currentRank: Node[] = [];
  let anchorY = Number.NEGATIVE_INFINITY;
  for (const n of sortedByY) {
    if (currentRank.length === 0 || Math.abs(n.position.y - anchorY) <= Y_TOLERANCE) {
      if (currentRank.length === 0) anchorY = n.position.y;
      currentRank.push(n);
    } else {
      ranks.push(currentRank);
      currentRank = [n];
      anchorY = n.position.y;
    }
  }
  if (currentRank.length > 0) ranks.push(currentRank);

  // Build a map of node id → next-position. Start with original positions and
  // update only the IDs we move; everything else is preserved.
  const nextX = new Map<string, number>();
  for (const n of personNodes) nextX.set(n.id, n.position.x);

  for (const rank of ranks) {
    const sorted = [...rank].sort(
      (a, b) => (nextX.get(a.id)! - nextX.get(b.id)!),
    );
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const isPair = partnerKeys.has(pairKey(prev.id, curr.id));
      const gap = isPair ? partnerGap : minHorizontalGap;
      const requiredX = nextX.get(prev.id)! + width + gap;
      const currX = nextX.get(curr.id)!;
      if (currX < requiredX) {
        const deficit = requiredX - currX;
        // Push curr and all subsequent siblings in this rank by deficit so
        // their relative ordering is preserved.
        for (let j = i; j < sorted.length; j += 1) {
          const id = sorted[j].id;
          nextX.set(id, nextX.get(id)! + deficit);
        }
      }
    }
  }

  return nodes.map((n) => {
    if (n.type !== 'person') return n;
    const x = nextX.get(n.id);
    if (x === undefined || x === n.position.x) return n;
    return { ...n, position: { x, y: n.position.y } };
  });
}

/**
 * Per-rank linear tightening that pulls oversized horizontal gaps closed.
 *
 * The inverse of `relaxOverlapsByRank`: it acts only when the gap between
 * adjacent siblings exceeds the expected gap for the active node-style
 * mode. Use case: switching wide→compact shrinks each card from 240→120 px,
 * which leaves ~120 px of dead space between adjacent siblings; this pass
 * pulls them back together.
 *
 * Each rank is anchored to its ORIGINAL CENTER (not its leftmost node) so
 * the canvas doesn't drift left as content compresses — the rank collapses
 * symmetrically inward.
 *
 * Composition: in the canvas's mode-switch handler, run `relaxOverlapsByRank`
 * first (push apart on enlarge), then this (pull closer on shrink). Each
 * one is a no-op in the direction the other handles, so applying both
 * always yields exact `width + nodesep` (or `width + partnerGap` for
 * partner pairs) spacing per adjacent pair.
 *
 * Pure: returns a new `Node[]`; does not mutate input.
 */
export function tightenRankSpacing(
  nodes: Node[],
  edges: Edge[],
  nodeStyle: NodeStyle,
): Node[] {
  if (nodes.length === 0) return nodes;

  const isCompact = nodeStyle === 'compact';
  const width = isCompact ? COMPACT_NODE_WIDTH : NODE_WIDTH;
  const partnerGap = isCompact ? COMPACT_PARTNER_GAP : PARTNER_GAP;
  const expectedSiblingGap = isCompact ? 50 : 80; // matches Dagre's `nodesep`

  const Y_TOLERANCE = 5;

  const personNodes = nodes.filter((n) => n.type === 'person');
  if (personNodes.length === 0) return nodes;

  const nodeIdSet = new Set(personNodes.map((n) => n.id));
  const partnerKeys = collectPartnerPairKeys(edges, nodeIdSet);

  // Group by rank (same logic as relaxOverlapsByRank).
  const sortedByY = [...personNodes].sort(
    (a, b) => a.position.y - b.position.y,
  );
  const ranks: Node[][] = [];
  let currentRank: Node[] = [];
  let anchorY = Number.NEGATIVE_INFINITY;
  for (const n of sortedByY) {
    if (currentRank.length === 0 || Math.abs(n.position.y - anchorY) <= Y_TOLERANCE) {
      if (currentRank.length === 0) anchorY = n.position.y;
      currentRank.push(n);
    } else {
      ranks.push(currentRank);
      currentRank = [n];
      anchorY = n.position.y;
    }
  }
  if (currentRank.length > 0) ranks.push(currentRank);

  const nextX = new Map<string, number>();
  for (const n of personNodes) nextX.set(n.id, n.position.x);

  for (const rank of ranks) {
    if (rank.length <= 1) continue;

    const sorted = [...rank].sort(
      (a, b) => nextX.get(a.id)! - nextX.get(b.id)!,
    );

    // Remember the original center so we can preserve it after tightening.
    const origLeftmostX = nextX.get(sorted[0].id)!;
    const origRightmostX = nextX.get(sorted[sorted.length - 1].id)!;
    const origCenter = (origLeftmostX + origRightmostX) / 2;

    // Pass 1: pull excess gaps closed (anchored at the leftmost node).
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const isPair = partnerKeys.has(pairKey(prev.id, curr.id));
      const expectedGap = isPair ? partnerGap : expectedSiblingGap;
      const expectedX = nextX.get(prev.id)! + width + expectedGap;
      const currX = nextX.get(curr.id)!;
      if (currX > expectedX) {
        const excess = currX - expectedX;
        for (let j = i; j < sorted.length; j += 1) {
          const id = sorted[j].id;
          nextX.set(id, nextX.get(id)! - excess);
        }
      }
    }

    // Pass 2: re-center the rank around its original center so the canvas
    // doesn't drift leftward as content compresses.
    const newRightmostX = nextX.get(sorted[sorted.length - 1].id)!;
    const newCenter = (origLeftmostX + newRightmostX) / 2;
    const shift = origCenter - newCenter;
    if (shift !== 0) {
      for (const node of sorted) {
        nextX.set(node.id, nextX.get(node.id)! + shift);
      }
    }
  }

  return nodes.map((n) => {
    if (n.type !== 'person') return n;
    const x = nextX.get(n.id);
    if (x === undefined || x === n.position.x) return n;
    return { ...n, position: { x, y: n.position.y } };
  });
}

/**
 * Uniformly scales every person-node X around the global centroid by the
 * ratio of expected sibling strides between modes. Use case: mode switch
 * needs to preserve every pairwise relative position so a parent stays
 * vertically aligned with its child, a singleton ancestor (placed via
 * STEP D in `applyDagreLayout`) stays directly above its descendant, and
 * any user drag carries through proportionally.
 *
 * Why this beats a per-rank tighten/relax pass: per-rank passes anchor at
 * each rank's own center, so a rank with N nodes shrinks differently than
 * a rank with M nodes — and a rank with a single node doesn't shrink at
 * all. The result is cross-rank misalignment (e.g. a paternal grandfather
 * "stranded" above where his son USED to be). A single global pivot moves
 * everyone by the same proportional shift.
 *
 * Stride ratios for the two adjacency types are slightly different
 * (compact/wide siblings = 170/320 ≈ 0.531, partner pairs = 144/280 ≈
 * 0.514), so post-scale partner gaps land within ~9px of ideal. Compose
 * with `relaxOverlapsByRank` to push apart any pair that scaled too tight
 * (compact→wide direction); the wide→compact direction leaves pair gaps
 * ~5px wider than ideal, which is visually imperceptible.
 *
 * Pure: returns a new Node[]; does not mutate input.
 */
export function rescaleSpacingByMode(
  nodes: Node[],
  fromStyle: NodeStyle,
  toStyle: NodeStyle,
): Node[] {
  if (fromStyle === toStyle || nodes.length === 0) return nodes;
  const personNodes = nodes.filter((n) => n.type === 'person');
  if (personNodes.length === 0) return nodes;

  const stride = (s: NodeStyle): number =>
    (s === 'compact' ? COMPACT_NODE_WIDTH : NODE_WIDTH) +
    (s === 'compact' ? 50 : 80);
  const factor = stride(toStyle) / stride(fromStyle);

  // Pivot: centroid of all person X positions. Robust to outliers via the
  // mean (single dragged-far node skews by 1/N which is fine for typical
  // tree sizes; if this ever becomes a problem switch to median).
  const xs = personNodes.map((n) => n.position.x);
  const pivot = xs.reduce((a, b) => a + b, 0) / xs.length;

  return nodes.map((n) => {
    if (n.type !== 'person') return n;
    const newX = pivot + (n.position.x - pivot) * factor;
    return { ...n, position: { x: newX, y: n.position.y } };
  });
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
