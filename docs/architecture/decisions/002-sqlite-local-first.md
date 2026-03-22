# ADR-002: SQLite with Local-First Architecture

> Date: 2026-03-21 | Status: Accepted

## Context

Two architectural questions needed resolution:

1. **Database choice:** Family trees are naturally graphs, and Neo4j is a graph-native database. However, the research doc's Neo4j proposal required Java runtime, operational overhead (server processes), and complex DevOps. SQLite, by contrast, is file-based, zero-operational overhead, and can handle 10K+ person trees with recursive CTEs.

2. **Deployment model:** The user wants personal genealogy data under their control (local-first), but also wants a path to family sharing (web deployment) without architectural rewrite.

## Decision

**Combine two decisions:**

### 1. SQLite Over Neo4j (Database)

Use **SQLite with recursive Common Table Expressions (CTEs)** for all family tree queries.

- Local development & production: `better-sqlite3` driver (synchronous, in-process)
- Web deployment: `@libsql/client` driver (Turso edge SQLite, same database protocol)
- ORM: Drizzle abstracts the driver difference completely

### 2. Local-First with Web Path (Deployment)

| Mode | Database | Hosting | Use Case |
|------|----------|---------|----------|
| **Local Development** | SQLite via better-sqlite3 | `next dev` on localhost | Primary development environment |
| **Local Production** | SQLite via better-sqlite3 | `next start` on localhost | Personal daily use (one user) |
| **Web (Family Sharing)** | Turso (edge SQLite) | Vercel free tier | Share with family members (multi-user) |

Transition from local to web requires **only changing the database driver** — no schema changes, no API redesign, no architectural changes.

## Reasons

### SQLite Over Neo4j

1. **Zero operational overhead:** SQLite is a single file. No Java, no server process, no ports to manage. Compare to Neo4j: requires Java 11+, heap tuning, startup time.
2. **Excellent performance for genealogy:** SQLite handles 100K+ persons and 1M+ events efficiently. Recursive CTEs cover all typical genealogy queries:
   - Ancestor chain: `WITH RECURSIVE ancestors AS ...`
   - Descendant tree: `WITH RECURSIVE descendants AS ...`
   - Relationship paths: Custom code (no worse than Neo4j Cypher for genealogy)
3. **Portable data:** The entire database is one `.db` file. Backup, version control, email to family members — trivial.
4. **Single-player sustainability:** As solo developer, managing one database beats managing Neo4j.
5. **Upgrade path:** If graph queries become essential, add PostgreSQL + Apache AGE (PostgreSQL extension for graph queries) without replacing SQLite. Maintain SQLite for local development.
6. **Familiar SQL:** No new query language (Cypher), no GraphQL learning curve. Standard SQL + CTEs.

### Local-First With Web Path

1. **Data sovereignty:** User controls the database file locally. Zero cloud dependency for personal genealogy.
2. **Offline-capable:** Local SQLite = full app functionality without internet. Web sync happens when online.
3. **Zero hosting costs for MVP:** Running locally is free. Web deployment is optional and deferred.
4. **Driver abstraction:** Drizzle ORM's database driver is swappable. Code written for `better-sqlite3` works with `@libsql/client` (Turso) with zero code changes — only env var swap.
5. **Simple upgrade path:** Start local, scale to web sharing without rewriting backend.
6. **Privacy-first default:** All data stays local unless user explicitly chooses web sync.

## Consequences

### Database Consequences

1. **Complex path queries require custom code:** Querying "all paths between person A and person B" needs algorithm code (DFS/BFS), not a single Cypher query. Acceptable trade-off for genealogy use cases — most queries are ancestor/descendant chains.
2. **No built-in graph visualization:** family-chart and Topola handle visualization; database is "just" a schema. This is actually good separation of concerns.
3. **Scaling limits:** SQLite is single-threaded. For 100K+ persons with many concurrent users, PostgreSQL is better. But local development and family sharing (<10 users) is fine.

### Deployment Consequences

1. **PWA must be offline-first by design:** Service Worker caching, IndexedDB for optimistic edits, sync queue for pending changes.
2. **Sync strategy needed for multi-user:** When user enables web deployment and family members join, need conflict resolution (CRDT or timestamp-based). Detailed in Phase 5 (Collaboration section).
3. **Database migration path:** If scaling to 100+ users, migrate SQLite → PostgreSQL. Drizzle makes this possible but requires schema review.

## Design Details

### Recursive CTE Examples

**Ancestor Chain (birth → parents → grandparents):**
```sql
WITH RECURSIVE ancestors AS (
  SELECT id, partner1_id, partner2_id FROM persons WHERE id = ?
  UNION ALL
  SELECT p.id, p.partner1_id, p.partner2_id
  FROM persons p
  INNER JOIN children c ON p.id IN (c.person1_id, c.person2_id)
  INNER JOIN ancestors a ON a.id = c.person_id
)
SELECT * FROM ancestors;
```

**Descendant Tree (child → children → grandchildren):**
```sql
WITH RECURSIVE descendants AS (
  SELECT id FROM persons WHERE id = ?
  UNION ALL
  SELECT p.id FROM persons p
  INNER JOIN children c ON c.person_id = p.id
  INNER JOIN families f ON f.id = c.family_id
  INNER JOIN descendants d ON d.id IN (f.partner1_id, f.partner2_id)
)
SELECT * FROM descendants;
```

### Driver Abstraction (Drizzle)

**Local (development & production):**
```typescript
import Database from 'better-sqlite3';
const db = new Database(':memory:'); // or './genealogy.db'
const drizzle = drizzleDatabase(db);
```

**Web (Turso):**
```typescript
import { createClient } from '@libsql/client';
const db = createClient({
  url: 'libsql://...-org.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const drizzle = drizzleDatabase(db);
```

**Code using Drizzle is identical in both cases.** No conditional logic, no driver-specific syntax.

## Revisit Triggers

1. **Complex graph queries become common:** If 20%+ of queries are path-finding or cycle detection, evaluate PostgreSQL + Apache AGE.
2. **Concurrent user edits cause frequent conflicts:** If multi-user sync requires heavy CRDT logic, migrate to PostgreSQL with JSONB + PostgreSQL native types.
3. **Database grows beyond SQLite limits:** If >500K persons or >10M events, benchmark against PostgreSQL.

---

## Related Decisions

- **ADR-001:** JS/TS over Python (consequence: Drizzle can use libsql client without Python backend)
- **ADR-003:** Gramps as reference only (consequence: own schema design includes place hierarchy, event-based modeling from Gramps)
- **ADR-004:** (This ADR IS ADR-004 combined with database choice)
