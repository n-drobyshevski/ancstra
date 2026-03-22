# ADR-006: Closure Table for Pre-Computed Ancestor/Descendant Queries

> Date: 2026-03-21 | Status: Accepted

## Context

Genealogy apps require ancestor/descendant traversal constantly — rendering pedigree charts, computing relationship paths, finding common ancestors, analyzing tree gaps. The current schema uses SQLite recursive CTEs for these queries.

Performance analysis showed:
- **Ancestor/descendant queries** (recursive CTEs): ~5-15ms for simple chains, acceptable
- **Path-finding between two people** (complex CTE with LEFT JOINs + INSTR cycle detection): ~50-200ms, 30+ lines of fragile SQL, O(n²) string-based cycle detection
- **Common ancestor computation**: requires running the path-finding CTE, then parsing results — expensive

For 500-5K person trees (target scale), recursive CTEs work but are inefficient for repeated queries. The closure table pattern pre-computes all ancestor-descendant pairs, making these queries simple indexed SELECTs.

### Alternatives Considered

1. **Neo4j graph database**: 10-50x faster for graph traversal, but breaks local-first architecture (no embedded Neo4j for JS), loses Drizzle ORM, adds cloud dependency
2. **Hybrid SQLite + Neo4j**: Adds sync complexity for marginal gain at this scale
3. **Nested sets**: Good for read-heavy trees but genealogy trees are DAGs (multiple parents possible via step/foster), not strict hierarchies — nested sets don't handle DAGs
4. **Materialized path**: Stores ancestor paths as strings ("A/B/C/D") — limited query flexibility, path explosion for DAGs

## Decision

**Add an `ancestor_paths` closure table that pre-computes all ancestor-descendant pairs with depth. Keep recursive CTEs as fallback for ad-hoc queries.**

### Schema

```sql
CREATE TABLE ancestor_paths (
  ancestor_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  descendant_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX idx_ancestor_paths_descendant ON ancestor_paths(descendant_id);
CREATE INDEX idx_ancestor_paths_depth ON ancestor_paths(depth);
```

### Query Improvements

**All ancestors of person X** (was: 15-line recursive CTE):
```sql
SELECT p.*, ap.depth AS generation
FROM ancestor_paths ap
JOIN persons p ON p.id = ap.ancestor_id
WHERE ap.descendant_id = :personId
ORDER BY ap.depth;
```

**All descendants of person X:**
```sql
SELECT p.*, ap.depth AS generation
FROM ancestor_paths ap
JOIN persons p ON p.id = ap.descendant_id
WHERE ap.ancestor_id = :personId
ORDER BY ap.depth;
```

**Common ancestor / relationship path** (was: 30+ line CTE with INSTR cycle detection):
```sql
SELECT ap1.ancestor_id, ap1.depth AS depth1, ap2.depth AS depth2
FROM ancestor_paths ap1
JOIN ancestor_paths ap2 ON ap1.ancestor_id = ap2.ancestor_id
WHERE ap1.descendant_id = :person1Id AND ap2.descendant_id = :person2Id
ORDER BY (ap1.depth + ap2.depth)
LIMIT 1;
```

**Generation count:**
```sql
SELECT MAX(depth) FROM ancestor_paths WHERE descendant_id = :personId;
```

### Maintenance

The closure table is maintained via functions in `packages/db/queries/closure-table.ts`:

- `rebuildClosureTable(db)` — Full rebuild via recursive CTE. Run once after GEDCOM import.
- `addParentChildLink(db, parentId, childId)` — Incremental insert: adds (parent, child, 1) plus all (ancestor-of-parent, child, depth+1):
  ```sql
  INSERT OR IGNORE INTO ancestor_paths (ancestor_id, descendant_id, depth)
  SELECT ap.ancestor_id, :childId, ap.depth + 1
  FROM ancestor_paths ap
  WHERE ap.descendant_id = :parentId
  UNION ALL
  SELECT :parentId, :childId, 1;
  ```
- `removeParentChildLink(db, parentId, childId)` — Incremental delete: remove all paths through this link, then re-insert any still-valid paths from other parent connections.

### Also Included: Person Summary Table

A denormalized `person_summary` table eliminates JOINs for tree node rendering:

```sql
CREATE TABLE person_summary (
  person_id TEXT PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  birth_year INTEGER,
  death_year INTEGER,
  birth_place_name TEXT,
  sex TEXT,
  is_living INTEGER,
  father_id TEXT,
  mother_id TEXT,
  spouse_ids TEXT,        -- JSON array
  child_ids TEXT,         -- JSON array
  ancestor_count INTEGER DEFAULT 0,
  descendant_count INTEGER DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  completion_score INTEGER DEFAULT 0,
  updated_at TEXT
);
```

Maintained via application-level hooks after mutations. Rebuilt fully after GEDCOM import.

### Also Included: Compound Indexes

```sql
CREATE INDEX idx_events_person_date ON events(person_id, date_sort);
CREATE INDEX idx_children_person_family ON children(person_id, family_id);
```

## Reasons

1. **Dramatic query simplification**: Path-finding drops from 30+ lines of fragile SQL to a 5-line common ancestor JOIN.

2. **Performance**: Indexed SELECTs (~0.5-2ms) instead of recursive CTEs (~5-200ms). 5-50x improvement.

3. **No infrastructure changes**: Pure SQLite. No new database, no sync logic, no cloud dependency.

4. **Well-understood pattern**: Closure tables are a standard approach (used by Gramps, WordPress comment threads, organizational charts). Extensively documented in SQL literature.

5. **Preserves architecture**: Local-first, Drizzle ORM, portable .db file, offline capability — all unchanged.

6. **Manageable storage**: ~50K-100K rows for 5K persons (each person averages ~10-20 ancestors). Negligible for SQLite.

7. **Upgrade path**: If scale exceeds 50K persons or complex graph analytics are needed, Neo4j can be added as a graph query layer alongside SQLite. The closure table remains useful regardless.

## Consequences

1. **Write overhead**: Every parent-child link addition/removal triggers closure table updates. Incremental updates are fast (~1ms for individual edits). Full rebuild needed after GEDCOM import.

2. **Storage overhead**: Additional table with ~10-20 rows per person. Minimal impact.

3. **Consistency risk**: Closure table could drift from actual relationships if maintenance functions have bugs. Mitigation: periodic reconciliation job, rebuild on app startup if checksum mismatches.

4. **GEDCOM import**: Must rebuild closure table + person_summary after import (adds ~100-500ms to import time for 5K persons). Import pipeline defers this to post-transaction.

5. **DAG handling**: Step-parents, foster relationships create multiple paths. The closure table handles this naturally — a person can have multiple entries with different ancestors. The common ancestor query finds the closest shared ancestor regardless of path.

## Performance Impact

| Operation | Before (recursive CTE) | After (closure table) | Gain |
|-----------|----------------------|----------------------|------|
| Ancestors (10 gen) | ~5-15ms | ~0.5-2ms | 5-10x |
| Descendants (5 gen) | ~5-15ms | ~0.5-2ms | 5-10x |
| Path finding | ~50-200ms | ~2-5ms | 20-50x |
| Generation count | Recursive count | Indexed MAX | Trivial |

## Revisit Triggers

1. **50K+ person trees**: Closure table grows quadratically with tree depth. Monitor storage and write performance.

2. **Complex graph analytics needed**: If users need "all paths between A and B" or graph centrality — these require a graph database (Neo4j). Closure table only handles ancestor/descendant and common ancestor queries.

3. **Write-heavy workload**: If bulk relationship edits become common (batch imports, merges), the incremental maintenance overhead could accumulate. Consider deferred rebuilds.

---

## Related Decisions

- **ADR-002:** SQLite + Drizzle (this decision extends the SQLite schema, preserving the core architecture)
- **ADR-005:** React Flow visualization (consumes closure table data for rendering)

## GEDCOM Import Optimization (Related)

The GEDCOM import pipeline is also optimized:
1. PRAGMA tuning during import (synchronous=NORMAL, cache_size=64MB, temp_store=MEMORY)
2. Deferred index strategy (drop non-essential indexes before bulk insert, recreate after)
3. Batched FTS5 rebuild (rebuild all FTS5 tables once after commit, not row-by-row)
4. Closure table rebuilt once after import completes
5. Person summary bulk populated after import completes
