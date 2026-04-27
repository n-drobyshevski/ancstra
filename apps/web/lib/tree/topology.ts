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

/**
 * Compute the set of descendant IDs for the given person.
 * Walks downward through families (where person is a partner) -> childLinks.
 * BFS with visited set. The reference person is NOT in the result.
 */
export function computeDescendants(personId: string, treeData: TreeData): Set<string> {
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
