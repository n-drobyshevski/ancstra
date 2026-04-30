import { createCentralDb, ensureCentralSchema } from '@ancstra/db';

let _centralDb: ReturnType<typeof createCentralDb> | null = null;
let _ensureSchemaPromise: Promise<void> | null = null;

/**
 * Lazy-singleton accessor for the central DB.
 * On first call, also runs ensureCentralSchema (idempotent: safe to await every time).
 */
export async function getCentralDb() {
  if (!_centralDb) {
    _centralDb = createCentralDb();
  }
  if (!_ensureSchemaPromise) {
    _ensureSchemaPromise = ensureCentralSchema(_centralDb, 'singleton');
  }
  await _ensureSchemaPromise;
  return _centralDb;
}

/**
 * Synchronous accessor for callers that can't await (rare; prefer getCentralDb).
 * Caller is responsible for ensureCentralSchema side effects elsewhere.
 */
export function getCentralDbSync() {
  if (!_centralDb) {
    _centralDb = createCentralDb();
  }
  return _centralDb;
}
