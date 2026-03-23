import { sql } from 'drizzle-orm';
import { createLogger } from '@ancstra/shared';
import type { FamilyDatabase } from './index';

const log = createLogger('closure-table');

/**
 * Full rebuild of the ancestor_paths closure table from families + children.
 * Uses iterative BFS from root persons (those with no parents).
 */
export async function rebuildClosureTable(db: FamilyDatabase): Promise<void> {
  // 1. Delete all existing rows
  db.run(sql`DELETE FROM ancestor_paths`);

  // 2. Insert self-referencing rows for every non-deleted person
  db.run(sql`
    INSERT INTO ancestor_paths (ancestor_id, descendant_id, depth)
    SELECT id, id, 0 FROM persons WHERE deleted_at IS NULL
  `);

  // 3. Build parent->children map from families + children tables
  const familyRows = db.all<{ id: string; partner1_id: string | null; partner2_id: string | null }>(
    sql`SELECT id, partner1_id, partner2_id FROM families WHERE deleted_at IS NULL`
  );

  const childRows = db.all<{ family_id: string; person_id: string }>(
    sql`SELECT family_id, person_id FROM children`
  );

  // Map: parent_id -> child_id[]
  const parentToChildren = new Map<string, string[]>();
  // Set of all person IDs that are children (have parents)
  const hasParent = new Set<string>();

  for (const child of childRows) {
    const family = familyRows.find((f) => f.id === child.family_id);
    if (!family) continue;

    for (const parentId of [family.partner1_id, family.partner2_id]) {
      if (!parentId) continue;
      if (!parentToChildren.has(parentId)) {
        parentToChildren.set(parentId, []);
      }
      parentToChildren.get(parentId)!.push(child.person_id);
    }
    hasParent.add(child.person_id);
  }

  // 4. Find root persons (not in children table)
  const allPersons = db.all<{ id: string }>(
    sql`SELECT id FROM persons WHERE deleted_at IS NULL`
  );

  const roots = allPersons.filter((p) => !hasParent.has(p.id));

  // 5. BFS from each root
  for (const root of roots) {
    // Queue items: [personId, ancestorsWithDepths]
    // ancestorsWithDepths: array of [ancestorId, depthFromAncestorToCurrentPerson]
    const queue: Array<{ personId: string; ancestors: Array<[string, number]> }> = [
      { personId: root.id, ancestors: [[root.id, 0]] },
    ];

    while (queue.length > 0) {
      const { personId, ancestors } = queue.shift()!;
      const kids = parentToChildren.get(personId) || [];

      for (const childId of kids) {
        const childAncestors: Array<[string, number]> = [];

        for (const [ancestorId, depth] of ancestors) {
          const newDepth = depth + 1;
          db.run(sql`
            INSERT OR IGNORE INTO ancestor_paths (ancestor_id, descendant_id, depth)
            VALUES (${ancestorId}, ${childId}, ${newDepth})
          `);
          childAncestors.push([ancestorId, newDepth]);
        }

        // Add the child itself as an ancestor for its descendants
        childAncestors.push([childId, 0]);

        queue.push({ personId: childId, ancestors: childAncestors });
      }
    }
  }

  const count = db.all<{ cnt: number }>(sql`SELECT COUNT(*) as cnt FROM ancestor_paths`);
  log.info({ pathCount: count[0]?.cnt ?? 0 }, 'Closure table rebuild complete');
}

/**
 * Incremental insert when a child is linked to a family.
 * Handles two-parent families by inserting paths from both parents' ancestors.
 */
export async function addChildToFamily(
  db: FamilyDatabase,
  familyId: string,
  childId: string,
): Promise<void> {
  // Look up family partners
  const familyRows = db.all<{ partner1_id: string | null; partner2_id: string | null }>(
    sql`SELECT partner1_id, partner2_id FROM families WHERE id = ${familyId}`
  );

  if (familyRows.length === 0) return;
  const family = familyRows[0];

  // Ensure child has a self-reference row
  db.run(sql`
    INSERT OR IGNORE INTO ancestor_paths (ancestor_id, descendant_id, depth)
    VALUES (${childId}, ${childId}, 0)
  `);

  // For each non-null parent, create cross-product of ancestor paths
  for (const parentId of [family.partner1_id, family.partner2_id]) {
    if (!parentId) continue;

    // All ancestors of the parent (including self)
    const parentAncestors = db.all<{ ancestor_id: string; depth: number }>(
      sql`SELECT ancestor_id, depth FROM ancestor_paths WHERE descendant_id = ${parentId}`
    );

    // All descendants of the child (including self)
    const childDescendants = db.all<{ descendant_id: string; depth: number }>(
      sql`SELECT descendant_id, depth FROM ancestor_paths WHERE ancestor_id = ${childId}`
    );

    // Insert cross-product
    for (const ancestor of parentAncestors) {
      for (const descendant of childDescendants) {
        const newDepth = ancestor.depth + descendant.depth + 1;
        db.run(sql`
          INSERT OR IGNORE INTO ancestor_paths (ancestor_id, descendant_id, depth)
          VALUES (${ancestor.ancestor_id}, ${descendant.descendant_id}, ${newDepth})
        `);
      }
    }
  }
}

/**
 * Targeted subtree rebuild when a child is unlinked from a family.
 * Called AFTER the children row is already deleted from the DB.
 * Handles consanguinity by re-inserting still-valid paths.
 */
export async function removeChildFromFamily(
  db: FamilyDatabase,
  familyId: string,
  childId: string,
): Promise<void> {
  // 1. Collect all descendants of childId (including self)
  const descendants = db.all<{ descendant_id: string }>(
    sql`SELECT descendant_id FROM ancestor_paths WHERE ancestor_id = ${childId}`
  );

  const descendantIds = descendants.map((d) => d.descendant_id);

  // 2. Delete all non-self ancestor_paths rows for those descendants
  for (const descId of descendantIds) {
    db.run(sql`
      DELETE FROM ancestor_paths
      WHERE descendant_id = ${descId} AND ancestor_id != descendant_id
    `);
  }

  // 3. Re-walk from each descendant upward through remaining children/families links
  //    to re-insert any still-valid paths
  for (const descId of descendantIds) {
    // Find families this person belongs to as a child (remaining links)
    const childLinks = db.all<{ family_id: string }>(
      sql`SELECT family_id FROM children WHERE person_id = ${descId}`
    );

    for (const link of childLinks) {
      // Get the family's parents
      const familyRows = db.all<{ partner1_id: string | null; partner2_id: string | null }>(
        sql`SELECT partner1_id, partner2_id FROM families WHERE id = ${link.family_id}`
      );

      if (familyRows.length === 0) continue;
      const family = familyRows[0];

      for (const parentId of [family.partner1_id, family.partner2_id]) {
        if (!parentId) continue;

        // All ancestors of the parent (including self)
        const parentAncestors = db.all<{ ancestor_id: string; depth: number }>(
          sql`SELECT ancestor_id, depth FROM ancestor_paths WHERE descendant_id = ${parentId}`
        );

        // All descendants of descId (including self)
        const subDescendants = db.all<{ descendant_id: string; depth: number }>(
          sql`SELECT descendant_id, depth FROM ancestor_paths WHERE ancestor_id = ${descId}`
        );

        for (const ancestor of parentAncestors) {
          for (const sub of subDescendants) {
            const newDepth = ancestor.depth + sub.depth + 1;
            db.run(sql`
              INSERT OR IGNORE INTO ancestor_paths (ancestor_id, descendant_id, depth)
              VALUES (${ancestor.ancestor_id}, ${sub.descendant_id}, ${newDepth})
            `);
          }
        }
      }
    }
  }
}
