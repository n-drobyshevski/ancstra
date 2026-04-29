import type { TreeData } from '@ancstra/shared';
import type { Coloring } from './view-prefs-storage';
import { computeAncestors, computeDescendants } from './topology';

export interface ColorTone {
  /** CSS background color (used when `coloringStyle === 'fill'`).
   *  References a `--tree-coloring-*` design token in globals.css so
   *  light/dark variants are themed centrally. */
  bg: string;
  /** CSS border color (used when `coloringStyle === 'border'`).
   *  References the matching `--tree-coloring-*-border` token. */
  border: string;
}

// Tones reference the project's Indigo Heritage tokens (see globals.css).
// Each token has a paired dark-mode value, so .dark consumers get the
// appropriate desaturated tint automatically. Each tone exposes both a
// `bg` (subtle fill) and `border` (vivid stroke) variant; the consumer
// picks one based on the user's `coloringStyle` preference.
const GEN_TONES: ColorTone[] = [
  { bg: 'var(--tree-coloring-gen-0)', border: 'var(--tree-coloring-gen-0-border)' },
  { bg: 'var(--tree-coloring-gen-1)', border: 'var(--tree-coloring-gen-1-border)' },
  { bg: 'var(--tree-coloring-gen-2)', border: 'var(--tree-coloring-gen-2-border)' },
  { bg: 'var(--tree-coloring-gen-3)', border: 'var(--tree-coloring-gen-3-border)' },
  { bg: 'var(--tree-coloring-gen-4)', border: 'var(--tree-coloring-gen-4-border)' },
  { bg: 'var(--tree-coloring-gen-5)', border: 'var(--tree-coloring-gen-5-border)' },
];

const BRANCH_TONES = {
  paternal: {
    bg: 'var(--tree-coloring-branch-paternal)',
    border: 'var(--tree-coloring-branch-paternal-border)',
  } as ColorTone,
  maternal: {
    bg: 'var(--tree-coloring-branch-maternal)',
    border: 'var(--tree-coloring-branch-maternal-border)',
  } as ColorTone,
  self: {
    bg: 'var(--tree-coloring-branch-self)',
    border: 'var(--tree-coloring-branch-self-border)',
  } as ColorTone,
};

const LIVING_TONES = {
  living: {
    bg: 'var(--tree-coloring-living-living)',
    border: 'var(--tree-coloring-living-living-border)',
  } as ColorTone,
  deceased: {
    bg: 'var(--tree-coloring-living-deceased)',
    border: 'var(--tree-coloring-living-deceased-border)',
  } as ColorTone,
};

/**
 * Compute the per-person color tone for the active coloring mode. Returns an
 * empty map for `'off'` and for `'branch'` without a `focusPersonId` (visual
 * no-op, matches the spec's deferred-focus behavior).
 */
export function computeColoringMap(
  treeData: TreeData,
  mode: Coloring,
  focusPersonId?: string,
): Map<string, ColorTone> {
  const out = new Map<string, ColorTone>();
  if (mode === 'off') return out;

  if (mode === 'living') {
    for (const p of treeData.persons) {
      out.set(p.id, p.isLiving ? LIVING_TONES.living : LIVING_TONES.deceased);
    }
    return out;
  }

  if (mode === 'generation') {
    const depths = computeGenerationDepth(treeData, focusPersonId);
    const n = GEN_TONES.length;
    for (const [id, depth] of depths) {
      const idx = ((depth % n) + n) % n;
      out.set(id, GEN_TONES[idx]);
    }
    return out;
  }

  if (mode === 'branch') {
    if (!focusPersonId) return out;
    return computeBranchTones(treeData, focusPersonId);
  }

  return out;
}

interface FamilyIndex {
  childOf: Map<string, string[]>;
  familiesById: Map<string, TreeData['families'][number]>;
  partnerIn: Map<string, string[]>;
  childrenOfFamily: Map<string, string[]>;
}

function indexFamilies(treeData: TreeData): FamilyIndex {
  const childOf = new Map<string, string[]>();
  for (const cl of treeData.childLinks) {
    const list = childOf.get(cl.personId) ?? [];
    list.push(cl.familyId);
    childOf.set(cl.personId, list);
  }
  const familiesById = new Map(treeData.families.map((f) => [f.id, f]));
  const partnerIn = new Map<string, string[]>();
  for (const f of treeData.families) {
    if (f.partner1Id) {
      const list = partnerIn.get(f.partner1Id) ?? [];
      list.push(f.id);
      partnerIn.set(f.partner1Id, list);
    }
    if (f.partner2Id) {
      const list = partnerIn.get(f.partner2Id) ?? [];
      list.push(f.id);
      partnerIn.set(f.partner2Id, list);
    }
  }
  const childrenOfFamily = new Map<string, string[]>();
  for (const cl of treeData.childLinks) {
    const list = childrenOfFamily.get(cl.familyId) ?? [];
    list.push(cl.personId);
    childrenOfFamily.set(cl.familyId, list);
  }
  return { childOf, familiesById, partnerIn, childrenOfFamily };
}

/**
 * Generation depth keyed by personId. With a focus, depth 0 = focus, parents
 * = -1, children = +1, etc. (bidirectional BFS). Without a focus, depth =
 * longest ancestor chain; roots (persons with no parents) are 0, each
 * descendant is `1 + max(parent depth)` so generationally-deeper individuals
 * always rank deeper, even if they have a partner with unknown parents.
 */
export function computeGenerationDepth(
  treeData: TreeData,
  focusPersonId?: string,
): Map<string, number> {
  const idx = indexFamilies(treeData);

  if (focusPersonId) {
    const map = new Map<string, number>();
    const visited = new Set<string>([focusPersonId]);
    const queue: Array<[string, number]> = [[focusPersonId, 0]];
    map.set(focusPersonId, 0);
    while (queue.length > 0) {
      const [id, depth] = queue.shift()!;
      const upFamilies = idx.childOf.get(id) ?? [];
      for (const familyId of upFamilies) {
        const family = idx.familiesById.get(familyId);
        if (!family) continue;
        for (const parentId of [family.partner1Id, family.partner2Id]) {
          if (!parentId || visited.has(parentId)) continue;
          visited.add(parentId);
          map.set(parentId, depth - 1);
          queue.push([parentId, depth - 1]);
        }
      }
      const downFamilies = idx.partnerIn.get(id) ?? [];
      for (const familyId of downFamilies) {
        const childIds = idx.childrenOfFamily.get(familyId) ?? [];
        for (const childId of childIds) {
          if (visited.has(childId)) continue;
          visited.add(childId);
          map.set(childId, depth + 1);
          queue.push([childId, depth + 1]);
        }
      }
    }
    return map;
  }

  // No focus: max-depth memoized recursion, cycle-safe.
  const memo = new Map<string, number>();
  const inProgress = new Set<string>();
  const depthOf = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (inProgress.has(id)) return 0;
    inProgress.add(id);
    const upFamilies = idx.childOf.get(id) ?? [];
    const parentDepths: number[] = [];
    for (const familyId of upFamilies) {
      const family = idx.familiesById.get(familyId);
      if (!family) continue;
      for (const parentId of [family.partner1Id, family.partner2Id]) {
        if (parentId) parentDepths.push(depthOf(parentId));
      }
    }
    inProgress.delete(id);
    const d = parentDepths.length === 0 ? 0 : 1 + Math.max(...parentDepths);
    memo.set(id, d);
    return d;
  };
  for (const person of treeData.persons) depthOf(person.id);
  return memo;
}

/**
 * Paint focus + descendants 'self', father-line lineage 'paternal', mother-line
 * 'maternal'. Sex drives paternal/maternal assignment (M=paternal, F=maternal);
 * when both parents share a sex (or are unknown), partner1=paternal,
 * partner2=maternal as a deterministic fallback.
 */
export function computeBranchTones(
  treeData: TreeData,
  focusPersonId: string,
): Map<string, ColorTone> {
  const out = new Map<string, ColorTone>();
  const personsById = new Map(treeData.persons.map((p) => [p.id, p]));
  if (!personsById.has(focusPersonId)) return out;
  const familiesById = new Map(treeData.families.map((f) => [f.id, f]));

  let paternalParentId: string | null = null;
  let maternalParentId: string | null = null;
  const focusChildLinks = treeData.childLinks.filter((cl) => cl.personId === focusPersonId);
  for (const cl of focusChildLinks) {
    const fam = familiesById.get(cl.familyId);
    if (!fam) continue;
    const p1 = fam.partner1Id ? personsById.get(fam.partner1Id) : null;
    const p2 = fam.partner2Id ? personsById.get(fam.partner2Id) : null;
    if (p1?.sex === 'M') paternalParentId ??= p1.id;
    else if (p2?.sex === 'M') paternalParentId ??= p2.id;
    if (p1?.sex === 'F') maternalParentId ??= p1.id;
    else if (p2?.sex === 'F') maternalParentId ??= p2.id;
    if (!paternalParentId && !maternalParentId) {
      paternalParentId = fam.partner1Id ?? null;
      maternalParentId = fam.partner2Id ?? null;
    }
  }

  // 1. Focus + focus's descendants → 'self' (highest priority).
  out.set(focusPersonId, BRANCH_TONES.self);
  for (const id of computeDescendants(focusPersonId, treeData)) {
    out.set(id, BRANCH_TONES.self);
  }

  const paintLineage = (rootParentId: string | null, tone: ColorTone) => {
    if (!rootParentId) return;
    const ancestors = computeAncestors(rootParentId, treeData);
    ancestors.add(rootParentId);
    for (const ancId of ancestors) {
      if (!out.has(ancId)) out.set(ancId, tone);
      // Their other descendants (uncles/aunts/cousins) too.
      for (const d of computeDescendants(ancId, treeData)) {
        if (!out.has(d)) out.set(d, tone);
      }
    }
  };

  paintLineage(paternalParentId, BRANCH_TONES.paternal);
  paintLineage(maternalParentId, BRANCH_TONES.maternal);

  return out;
}
