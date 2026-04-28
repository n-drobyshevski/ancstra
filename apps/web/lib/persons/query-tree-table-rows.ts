import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';
import type { PersonListItem } from '@ancstra/shared';
import type { TreeTableFilters } from '../tree/search-params';
import { buildTreeTableWhere } from './tree-filters-to-where';
import { searchPersonsFts } from '../queries';
import { getTopologyIds } from './tree-topology-ids';

/** Row passed to TanStack — same shape the existing column defs expect. */
export interface TreeTableRow extends PersonListItem {
  childCount: number;
}

/** Relationship maps keyed by person ID, populated only for the visible page. */
export interface TreeTableRelationships {
  parents: Record<string, { id: string; name: string }[]>;
  spouses: Record<string, { id: string; name: string }[]>;
}

export interface TreeTableResult {
  items: TreeTableRow[];
  relationships: TreeTableRelationships;
  total: number;
}

const SORT_COLUMN: Record<TreeTableFilters['sort'], string> = {
  name: 'ps.surname',
  lifespan: 'ps.birth_date_sort',
  sex: 'ps.sex',
  children: 'ps.child_count',
};

// Reads the paginated page of person_summary then enriches the page-sized
// id list with parent/spouse names. child_count is denormalized so no extra
// CTE is needed for the children column.
export async function queryTreeTableRows(
  db: Database,
  filters: TreeTableFilters,
): Promise<TreeTableResult> {
  // Build the restricted-id set by intersecting the topology lineage (when
  // active) with the FTS results (when a query is present). Either source
  // can produce an empty set, which short-circuits the WHERE to `1 = 0`.
  const topologyIds = await getTopologyIds(db, filters.topologyAnchor, filters.topologyMode);
  let restrictedIds: readonly string[] | undefined;

  if (filters.q.trim() !== '') {
    const ftsResults = await searchPersonsFts(db, filters.q.trim(), 1000);
    const ftsIds = ftsResults.map((r) => r.id);
    if (topologyIds !== null) {
      const allowed = new Set(topologyIds);
      restrictedIds = ftsIds.filter((id) => allowed.has(id));
    } else {
      restrictedIds = ftsIds;
    }
  } else if (topologyIds !== null) {
    restrictedIds = topologyIds;
  }

  const whereConds = buildTreeTableWhere(filters, restrictedIds);
  // Always exclude soft-deleted persons (mirrors getTreeData).
  whereConds.push(sql`NOT EXISTS (
    SELECT 1 FROM persons p WHERE p.id = ps.person_id AND p.deleted_at IS NOT NULL
  )`);

  const whereSql = sql.join(
    [sql`WHERE `, sql.join(whereConds, sql` AND `)],
    sql``,
  );

  const sortCol = SORT_COLUMN[filters.sort];
  const dir = filters.dir === 'desc' ? sql.raw('DESC') : sql.raw('ASC');
  const sortClause =
    filters.sort === 'lifespan'
      ? sql`ORDER BY ${sql.raw(sortCol)} ${dir} NULLS LAST, ps.person_id ASC`
      : sql`ORDER BY ${sql.raw(sortCol)} ${dir}, ps.person_id ASC`;

  const offset = (filters.page - 1) * filters.size;

  const rows = await db.all<{
    id: string;
    given_name: string;
    surname: string;
    sex: 'M' | 'F' | 'U';
    is_living: number;
    birth_date: string | null;
    death_date: string | null;
    birth_place: string | null;
    completeness: number;
    sources_count: number;
    has_name: number;
    has_birth_event: number;
    has_birth_place: number;
    has_death_event: number;
    has_source: number;
    validation: 'confirmed' | 'proposed';
    child_count: number;
    total: number;
  }>(sql`
    SELECT
      ps.person_id AS id,
      ps.given_name, ps.surname, ps.sex, ps.is_living,
      ps.birth_date, ps.death_date, ps.birth_place,
      ps.completeness, ps.sources_count,
      ps.has_name, ps.has_birth_event, ps.has_birth_place,
      ps.has_death_event, ps.has_source,
      ps.validation,
      ps.child_count,
      count(*) OVER () AS total
    FROM person_summary ps
    ${whereSql}
    ${sortClause}
    LIMIT ${filters.size} OFFSET ${offset}
  `);

  const items: TreeTableRow[] = rows.map((r) => ({
    id: r.id,
    givenName: r.given_name,
    surname: r.surname,
    sex: r.sex,
    isLiving: Boolean(r.is_living),
    birthDate: r.birth_date,
    birthPlace: r.birth_place,
    deathDate: r.death_date,
    completeness: r.completeness,
    sourcesCount: r.sources_count,
    hasName: Boolean(r.has_name),
    hasBirthEvent: Boolean(r.has_birth_event),
    hasBirthPlace: Boolean(r.has_birth_place),
    hasDeathEvent: Boolean(r.has_death_event),
    hasSource: Boolean(r.has_source),
    validation: r.validation,
    childCount: r.child_count,
  }));

  const total = rows.length > 0 ? rows[0].total : 0;

  // Skip the relationship lookup entirely when both columns are hidden — saves
  // the two indexed roundtrips for users who only want the bare facts.
  const skipRelationships =
    filters.hide.includes('parents') && filters.hide.includes('spouses');

  const relationships =
    items.length > 0 && !skipRelationships
      ? await fetchPageRelationships(db, items.map((i) => i.id))
      : { parents: {}, spouses: {} };

  return { items, relationships, total };
}

// Fetches parent + spouse names for the page IDs in two indexed lookups.
async function fetchPageRelationships(
  db: Database,
  pageIds: string[],
): Promise<TreeTableRelationships> {
  const idList = sql.join(pageIds.map((id) => sql`${id}`), sql`, `);

  const [parentRows, spouseRows] = await Promise.all([
    // Parents: walk children → families → both partners.
    db.all<{ child_id: string; parent_id: string; given_name: string; surname: string }>(sql`
      SELECT c.person_id AS child_id,
             pp.person_id AS parent_id,
             pp.given_name,
             pp.surname
      FROM children c
      JOIN families f ON f.id = c.family_id AND f.deleted_at IS NULL
      JOIN person_summary pp
        ON pp.person_id = f.partner1_id
        OR pp.person_id = f.partner2_id
      WHERE c.person_id IN (${idList})
        AND pp.person_id IS NOT NULL
    `),
    // Spouses: emit one row per direction so both partners get their entry
    // populated even when both are in the visible page.
    db.all<{ me: string; spouse_id: string; given_name: string; surname: string }>(sql`
      SELECT f.partner1_id AS me,
             sp.person_id AS spouse_id,
             sp.given_name,
             sp.surname
      FROM families f
      JOIN person_summary sp ON sp.person_id = f.partner2_id
      WHERE f.deleted_at IS NULL
        AND f.partner1_id IN (${idList})
        AND f.partner2_id IS NOT NULL
      UNION ALL
      SELECT f.partner2_id AS me,
             sp.person_id AS spouse_id,
             sp.given_name,
             sp.surname
      FROM families f
      JOIN person_summary sp ON sp.person_id = f.partner1_id
      WHERE f.deleted_at IS NULL
        AND f.partner2_id IN (${idList})
        AND f.partner1_id IS NOT NULL
    `),
  ]);

  const parents: Record<string, { id: string; name: string }[]> = {};
  for (const row of parentRows) {
    const list = (parents[row.child_id] ??= []);
    if (!list.some((p) => p.id === row.parent_id)) {
      list.push({ id: row.parent_id, name: `${row.given_name} ${row.surname}`.trim() });
    }
  }

  const spouses: Record<string, { id: string; name: string }[]> = {};
  for (const row of spouseRows) {
    const list = (spouses[row.me] ??= []);
    if (!list.some((s) => s.id === row.spouse_id)) {
      list.push({ id: row.spouse_id, name: `${row.given_name} ${row.surname}`.trim() });
    }
  }

  return { parents, spouses };
}
