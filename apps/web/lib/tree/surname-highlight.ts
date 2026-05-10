/**
 * Surname-branch highlighting (patrilineal-line semantics).
 *
 * The "Smith branch" is the set of people whose patrilineal connected
 * component contains at least one person currently named Smith. Edges are
 * built only from `(father → child)` where the father's sex is `'M'`. This
 * naturally:
 *   - includes male-line descendants of any Smith man
 *   - includes daughters born into the line (they share a father edge with
 *     their Smith father; they are component members)
 *   - excludes children of those daughters once they take a non-Smith
 *     husband's surname (their father edge points into the husband's
 *     component, not the Smith one)
 *   - excludes married-in spouses (no incoming father edge from the line)
 *
 * Mother edges are intentionally not added, because matrilineal connections
 * are not part of the "patrilineal surname branch" definition.
 */
import type { TreeData } from '@ancstra/shared';

export function normalizeSurname(s: string | null | undefined): string {
  return (s ?? '').trim().toLocaleLowerCase();
}

interface ComponentIndex {
  /** personId → componentId (small int). */
  componentOf: Map<string, number>;
  /** componentId → list of member personIds. */
  members: Map<number, string[]>;
}

/**
 * Compute connected components over the patrilineal edge set
 * `{ (father, child) | father.sex === 'M' }`. Persons with no father link of
 * that kind end up in their own singleton component.
 */
export function computePatrilinealComponents(treeData: TreeData): ComponentIndex {
  const personsById = new Map(treeData.persons.map((p) => [p.id, p]));
  const familiesById = new Map(treeData.families.map((f) => [f.id, f]));

  // Build an adjacency list of patrilineal edges (undirected for the
  // component walk).
  const adj = new Map<string, string[]>();
  const addEdge = (a: string, b: string) => {
    const la = adj.get(a);
    if (la) la.push(b);
    else adj.set(a, [b]);
    const lb = adj.get(b);
    if (lb) lb.push(a);
    else adj.set(b, [a]);
  };

  // Group child links by family for an efficient pass.
  const childrenOfFamily = new Map<string, string[]>();
  for (const cl of treeData.childLinks) {
    const list = childrenOfFamily.get(cl.familyId);
    if (list) list.push(cl.personId);
    else childrenOfFamily.set(cl.familyId, [cl.personId]);
  }

  for (const [familyId, childIds] of childrenOfFamily) {
    const family = familiesById.get(familyId);
    if (!family) continue;
    // Identify the father (the male partner). If both partners are male we
    // pick the first; if neither is male we add no edge for this family.
    const p1 = family.partner1Id ? personsById.get(family.partner1Id) : null;
    const p2 = family.partner2Id ? personsById.get(family.partner2Id) : null;
    let fatherId: string | null = null;
    if (p1?.sex === 'M') fatherId = p1.id;
    else if (p2?.sex === 'M') fatherId = p2.id;
    if (!fatherId) continue;
    for (const childId of childIds) {
      if (!personsById.has(childId)) continue;
      addEdge(fatherId, childId);
    }
  }

  // Walk components with iterative BFS so very large trees don't blow the
  // stack.
  const componentOf = new Map<string, number>();
  const members = new Map<number, string[]>();
  let nextComponent = 0;
  for (const person of treeData.persons) {
    if (componentOf.has(person.id)) continue;
    const cid = nextComponent++;
    const queue: string[] = [person.id];
    componentOf.set(person.id, cid);
    const list: string[] = [];
    members.set(cid, list);
    while (queue.length > 0) {
      const id = queue.shift()!;
      list.push(id);
      const neighbors = adj.get(id);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (componentOf.has(n)) continue;
        componentOf.set(n, cid);
        queue.push(n);
      }
    }
  }

  return { componentOf, members };
}

/**
 * Given a target surname, return the set of person ids that should be
 * highlighted as members of the surname's patrilineal branch. Returns an
 * empty set for empty / unmatched surnames.
 */
export function computeSurnameHighlightSet(
  treeData: TreeData,
  targetSurname: string | null | undefined,
): Set<string> {
  const target = normalizeSurname(targetSurname);
  if (!target) return new Set();

  const { componentOf, members } = computePatrilinealComponents(treeData);

  // Find which components carry the target surname (i.e., contain at least
  // one person with primary surname matching the target).
  const carrying = new Set<number>();
  for (const person of treeData.persons) {
    if (normalizeSurname(person.surname) !== target) continue;
    const cid = componentOf.get(person.id);
    if (cid !== undefined) carrying.add(cid);
  }

  const out = new Set<string>();
  for (const cid of carrying) {
    const list = members.get(cid);
    if (!list) continue;
    for (const id of list) out.add(id);
  }
  return out;
}

export interface SurnameOption {
  /** Normalized lowercase surname (matches the URL value). */
  value: string;
  /** Display surname with original casing (the most-frequent variant). */
  label: string;
  /** How many persons in the tree currently carry this surname. */
  count: number;
}

/**
 * Collect the distinct surnames currently in the tree, sorted by frequency
 * (descending) with alphabetical tie-break. Empty/whitespace surnames are
 * ignored. The display label preserves the casing of the most common spelling
 * so the picker reads naturally.
 */
export function collectSurnameOptions(treeData: TreeData): SurnameOption[] {
  // value → { count, casingCounts: Map<originalCasing, count> }
  const buckets = new Map<string, { count: number; casings: Map<string, number> }>();
  for (const p of treeData.persons) {
    const raw = (p.surname ?? '').trim();
    if (!raw) continue;
    const value = raw.toLocaleLowerCase();
    const bucket = buckets.get(value);
    if (bucket) {
      bucket.count += 1;
      bucket.casings.set(raw, (bucket.casings.get(raw) ?? 0) + 1);
    } else {
      const casings = new Map<string, number>();
      casings.set(raw, 1);
      buckets.set(value, { count: 1, casings });
    }
  }

  const options: SurnameOption[] = [];
  for (const [value, { count, casings }] of buckets) {
    let bestLabel = value;
    let bestCount = -1;
    for (const [label, c] of casings) {
      if (c > bestCount) {
        bestLabel = label;
        bestCount = c;
      }
    }
    options.push({ value, label: bestLabel, count });
  }
  options.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
  return options;
}
