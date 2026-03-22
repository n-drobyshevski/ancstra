# ADR 011: Turso Driver Swap Validation

## Status
**Validated** — 2026-03-22

## Context
Ancstra uses better-sqlite3 for local development but needs Turso (libsql) for web deployment. We needed to confirm that the Drizzle ORM schema and queries work identically across both drivers.

## Test Setup
- **Driver**: `drizzle-orm/libsql` with `@libsql/client` v0.17.2
- **Drizzle ORM**: v0.45.1
- **Test mode**: Local file (`file:turso-test.db`) — same libsql wire protocol as remote Turso
- **Schema**: Same table definitions as `packages/db/src/schema.ts`

## Test Results

| Operation | Result |
|---|---|
| Create tables (DDL) | PASS |
| Insert person (persons table) | PASS |
| Insert person_name (foreign key) | PASS |
| Insert event (birth, with dateSort) | PASS |
| Read person by ID + deletedAt filter | PASS |
| Read primary name with isPrimary filter | PASS |
| Read event with type filter | PASS |
| All field values match expected | PASS |
| Cleanup (DELETE cascade) | PASS |

All 7 field-level checks passed. No quirks or incompatibilities found.

## Key Findings
1. **Schema compatibility**: Identical DDL works on both better-sqlite3 and libsql
2. **Drizzle API**: Same `db.insert()`, `db.select()`, `db.delete()` calls work without modification
3. **Boolean handling**: `is_living` (INTEGER mode: boolean) round-trips correctly as `false`/`true`
4. **Integer columns**: `date_sort` integer values preserved exactly

## Decision
Use `@libsql/client` + `drizzle-orm/libsql` for Turso deployments. The driver swap is a single import change in the connection factory — no query changes needed.

## Connection Factory Pattern
```typescript
// Local: packages/db/src/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';

// Turso: packages/db/src/turso.ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
```

The app selects the factory based on `TURSO_DATABASE_URL` being set.
