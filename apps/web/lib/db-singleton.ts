import { createCentralDb, ensureCentralSchema } from '@ancstra/db';

let _centralDb: ReturnType<typeof createCentralDb> | null = null;
let _ensurePromise: Promise<void> | null = null;

function init() {
  if (!_centralDb) {
    _centralDb = createCentralDb();
    // Fire-and-forget: schema ensure runs in background. First sync caller
    // sees _centralDb immediately; the first ALTER may race the first SELECT
    // but both better-sqlite3 and libSQL serialize statements per-connection
    // so this works. Async callers (getCentralDb) await the promise to be safe.
    _ensurePromise = ensureCentralSchema(_centralDb, 'singleton');
    _ensurePromise.catch((err) => {
      console.error('[db-singleton] ensureCentralSchema failed:', err);
    });
  }
  return _centralDb;
}

export function getCentralDbSync() {
  return init();
}

export async function getCentralDb() {
  const db = init();
  if (_ensurePromise) await _ensurePromise;
  return db;
}
