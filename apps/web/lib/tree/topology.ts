import type { TreeData } from '@ancstra/shared';

/**
 * Compute the set of ancestor IDs for the given person.
 * Walks upward through childLinks -> families -> partners. BFS with visited set
 * so accidental cycles (data error) don't loop. The reference person is NOT in the result.
 */
export function computeAncestors(personId: string, treeData: TreeData): Set<string> {
  const ancestors = new Set<string>();
  const visited = new Set<string>([personId]);
  const queue: string[] = [personId];

  const childOf = new Map<string, string[]>();
  for (const cl of treeData.childLinks) {
    const list = childOf.get(cl.personId) ?? [];
    list.push(cl.familyId);
    childOf.set(cl.personId, list);
  }
  const familiesById = new Map(treeData.families.map((f) => [f.id, f]));

  while (queue.length > 0) {
    const id = queue.shift()!;
    const familyIds = childOf.get(id) ?? [];
    for (const familyId of familyIds) {
      const family = familiesById.get(familyId);
      if (!family) continue;
      for (const parentId of [family.partner1Id, family.partner2Id]) {
        if (!parentId) continue;
        if (visited.has(parentId)) continue;
        visited.add(parentId);
        ancestors.add(parentId);
        queue.push(parentId);
      }
    }
  }

  return ancestors;
}

export interface ComputeDescendantsOptions {
  /**
   * When `true`, also include the co-parent (spouse) of every family that
   * produces a descendant. Co-parents are added for visibility — so a
   * rendered descendants-only tree shows each child with both parents —
   * but they are NOT enqueued: their other-marriage descendants are
   * step-grandchildren of the anchor, not blood descendants, and would
   * balloon the set in connected graphs. Childless marriages never
   * contribute their spouse.
   *
   * Defaults to `false` (strict blood-only descent). Topology filtering
   * opts in to get a complete-looking visible set; branch coloring keeps
   * the default to preserve paternal/maternal/self disjointness (a
   * co-parent of a paternal cousin is an in-law, not a paternal blood
   * relative).
   */
  includeCoParents?: boolean;
}

/**
 * Compute the set of descendant IDs for the given person.
 * Walks downward through families (where person is a partner) -> childLinks.
 * BFS with visited set. The reference person is NOT in the result.
 *
 * See `ComputeDescendantsOptions.includeCoParents` for the option that
 * also pulls in spouses of every family that has descendants.
 */
export function computeDescendants(
  personId: string,
  treeData: TreeData,
  opts: ComputeDescendantsOptions = {},
): Set<string> {
  const includeCoParents = opts.includeCoParents === true;
  const descendants = new Set<string>();
  const visited = new Set<string>([personId]);
  const queue: string[] = [personId];

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
  const familiesById = includeCoParents
    ? new Map(treeData.families.map((f) => [f.id, f]))
    : null;
  const childrenOfFamily = new Map<string, string[]>();
  for (const cl of treeData.childLinks) {
    const list = childrenOfFamily.get(cl.familyId) ?? [];
    list.push(cl.personId);
    childrenOfFamily.set(cl.familyId, list);
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    const familyIds = partnerIn.get(id) ?? [];
    for (const familyId of familyIds) {
      const childIds = childrenOfFamily.get(familyId) ?? [];
      if (childIds.length === 0) continue;

      if (includeCoParents && familiesById) {
        const family = familiesById.get(familyId);
        if (family) {
          const otherPartnerId =
            family.partner1Id === id ? family.partner2Id : family.partner1Id;
          if (otherPartnerId && !visited.has(otherPartnerId)) {
            visited.add(otherPartnerId);
            descendants.add(otherPartnerId);
            // NOT enqueued: their other-marriage descendants aren't
            // descendants of the anchor.
          }
        }
      }

      for (const childId of childIds) {
        if (visited.has(childId)) continue;
        visited.add(childId);
        descendants.add(childId);
        queue.push(childId);
      }
    }
  }

  return descendants;
}
