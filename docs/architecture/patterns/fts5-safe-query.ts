// docs/architecture/patterns/fts5-safe-query.ts
// Integration target: packages/db/queries/search.ts
//
// Addresses: IS-9 (FTS5 query injection)

import { sql } from 'drizzle-orm';

/**
 * Safely construct an FTS5 MATCH query.
 * FTS5 has its own query syntax (AND, OR, NOT, *, NEAR, etc.)
 * that can be injected if user input is not sanitized.
 *
 * This function escapes FTS5 special characters and uses
 * parameterized queries via Drizzle's sql template tag.
 */
export function fts5SafeMatch(userQuery: string): ReturnType<typeof sql> {
  // Escape FTS5 special characters: * " ( ) : ^
  // Replace with spaces (removes operators, keeps search terms)
  const sanitized = userQuery
    .replace(/[*"()^:]/g, ' ')  // Remove FTS5 operators
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, '') // Remove FTS5 keywords
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0)
    .join(' ');

  if (sanitized.length === 0) {
    return sql`''`; // Empty query
  }

  // Use parameterized query — never concatenate
  return sql`${sanitized}`;
}

// Usage example with Drizzle:
//
// const results = await db
//   .select()
//   .from(ftsPersons)
//   .where(sql`fts_persons MATCH ${fts5SafeMatch(userInput)}`)
//   .limit(20);
