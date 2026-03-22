# FTS5 Search + Cmd+K Command Palette

> **Spec for:** SQLite FTS5 full-text search on person names, global command palette (Cmd+K), and unified search across the app.

---

## Scope

1. FTS5 virtual table (`persons_fts`) indexing given_name + surname from person_names
2. Auto-sync triggers on person_names insert/update/delete
3. New search API endpoint (`GET /api/search`) with FTS5 prefix matching + bm25 ranking
4. Upgrade `/persons` page search from LIKE to FTS5
5. Global command palette (Cmd+K / Ctrl+K / /) with person search + quick actions
6. shadcn Command component (built on cmdk)

---

## FTS5 Virtual Table

### Schema

```sql
-- External content FTS5 table linked to person_names
CREATE VIRTUAL TABLE persons_fts USING fts5(
  given_name,
  surname,
  content=person_names,
  content_rowid=rowid
);

-- Triggers to keep FTS in sync
CREATE TRIGGER persons_fts_ai AFTER INSERT ON person_names BEGIN
  INSERT INTO persons_fts(rowid, given_name, surname)
  VALUES (new.rowid, new.given_name, new.surname);
END;

CREATE TRIGGER persons_fts_ad AFTER DELETE ON person_names BEGIN
  INSERT INTO persons_fts(persons_fts, rowid, given_name, surname)
  VALUES ('delete', old.rowid, old.given_name, old.surname);
END;

CREATE TRIGGER persons_fts_au AFTER UPDATE ON person_names BEGIN
  INSERT INTO persons_fts(persons_fts, rowid, given_name, surname)
  VALUES ('delete', old.rowid, old.given_name, old.surname);
  INSERT INTO persons_fts(rowid, given_name, surname)
  VALUES (new.rowid, new.given_name, new.surname);
END;
```

Since Drizzle doesn't support FTS5 virtual tables natively, this SQL runs as a raw migration or in a setup script.

### Rebuild command

For initial population (after GEDCOM import or first setup):
```sql
INSERT INTO persons_fts(persons_fts) VALUES('rebuild');
```

---

## Search API

### `GET /api/search?q=<term>&limit=10`

- Auth required
- `q` parameter required (min 1 char), `limit` optional (default 10, max 50)
- FTS5 query: `persons_fts MATCH '<term>*'` (prefix matching)
- Join: `persons_fts` → `person_names` (via rowid) → `persons` (via person_id)
- Filter: `persons.deleted_at IS NULL`, `person_names.is_primary = 1`
- Order by: `bm25(persons_fts)` (relevance ranking)
- Returns: `{ persons: PersonListItem[] }`

Actions are static — filtered client-side, not via the API.

### Query helper: `searchPersonsFts(db, query, limit)` in `lib/queries.ts`

```typescript
export function searchPersonsFts(db: Database, query: string, limit: number = 10): PersonListItem[]
```

Uses raw SQL since Drizzle doesn't have FTS5 query builder support:
```sql
SELECT p.id, p.sex, p.is_living, pn.given_name, pn.surname
FROM persons_fts
JOIN person_names pn ON pn.rowid = persons_fts.rowid
JOIN persons p ON p.id = pn.person_id
WHERE persons_fts MATCH ?
  AND p.deleted_at IS NULL
  AND pn.is_primary = 1
ORDER BY bm25(persons_fts)
LIMIT ?
```

Adds birth/death dates from events (same pattern as existing getTreeData).

---

## Upgrade /persons Page

Replace LIKE query with FTS5:
- When `?q=` is present on `GET /api/persons`, use `searchPersonsFts()` instead of the current LIKE filter
- Same response shape: `{ items, total, page, pageSize }`
- For count: run a separate FTS5 count query
- When `?q=` is absent: keep the existing unfiltered paginated query (no change)

---

## Command Palette UI

### Component: `components/command-palette.tsx`

Client component using shadcn `Command` + `CommandDialog`.

**Keyboard triggers:**
- `Cmd+K` (Mac) / `Ctrl+K` (Windows) — global
- `/` key when not in an input field — global
- Rendered in root layout `app/layout.tsx` so available on every page

**Layout:**
```
┌────────────────────────────────────┐
│ 🔍 Search people or type a command │
├────────────────────────────────────┤
│ People                             │
│  John Smith (M, b. 1845)      →   │
│  Mary Johnson (F, b. ~1850)   →   │
│  John Adams (M, b. 1735)     →   │
├────────────────────────────────────┤
│ Actions                            │
│  + Add New Person                  │
│  📥 Import GEDCOM                  │
│  📤 Export GEDCOM                  │
│  🌳 Go to Tree                    │
│  👤 Go to People                  │
│  📚 Go to Sources                 │
│  🏠 Go to Dashboard               │
└────────────────────────────────────┘
```

**Behavior:**
- Debounced search (200ms) as user types → `GET /api/search?q=<term>&limit=8`
- "People" group shows FTS5 results (empty if no query or no matches)
- "Actions" group always visible, filtered client-side by query text
- Click person → `router.push('/person/[id]')`, close palette
- Click action → `router.push(route)`, close palette
- Escape → close
- Arrow keys navigate results (handled by cmdk)
- Enter selects highlighted result

**Static actions list:**
```typescript
const actions = [
  { label: 'Add New Person', href: '/person/new', keywords: ['add', 'create', 'new', 'person'] },
  { label: 'Import GEDCOM', href: '/import', keywords: ['import', 'gedcom', 'upload'] },
  { label: 'Export GEDCOM', href: '/export', keywords: ['export', 'gedcom', 'download'] },
  { label: 'Go to Tree', href: '/tree', keywords: ['tree', 'canvas', 'visualization'] },
  { label: 'Go to People', href: '/persons', keywords: ['people', 'persons', 'list'] },
  { label: 'Go to Sources', href: '/sources', keywords: ['sources', 'citations'] },
  { label: 'Go to Dashboard', href: '/dashboard', keywords: ['dashboard', 'home'] },
];
```

Actions filtered: if query matches label or any keyword (case-insensitive includes).

---

## Integration Points

- **Root layout** (`app/layout.tsx`): Render `<CommandPalette />` inside `<ThemeProvider>`, available globally
- **Tree canvas**: Remove the `/` key placeholder, let it bubble to command palette
- **App header**: Optional search button that opens the palette (visual affordance)

---

## File Structure

```
packages/db/
  migrations/XXXX-fts5.sql          — FTS5 virtual table + triggers (raw SQL migration)

apps/web/
  lib/
    queries.ts                      — ADD: searchPersonsFts() function

  app/api/
    search/route.ts                 — GET /api/search (FTS5 query)
    persons/route.ts                — MODIFY: replace LIKE with FTS5 when ?q= present

  components/
    command-palette.tsx             — Cmd+K command palette (shadcn Command + Dialog)
    app-header.tsx                  — MODIFY: add search button to open palette

  app/layout.tsx                    — MODIFY: render CommandPalette globally
```

### New Dependency
- `cmdk` — installed automatically by `shadcn add command`

---

## Tests

### `__tests__/api/search.test.ts`
- FTS5 search returns matching persons by prefix
- FTS5 search excludes soft-deleted persons
- FTS5 search returns empty for no match
- FTS5 search respects limit parameter
- Returns 400 for missing q parameter

Note: In-memory SQLite supports FTS5 if the SQLite build includes it (better-sqlite3 does by default). Tests create the FTS5 virtual table + triggers in beforeEach.

### `__tests__/api/persons.test.ts` (modifications)
- Existing search tests updated: ?q= now uses FTS5 instead of LIKE

---

## Out of Scope
- Search sources or events (persons only for now)
- Search history / recent searches
- Fuzzy matching (FTS5 does prefix, not fuzzy)
- Search from tree canvas (search-to-focus — separate feature)
