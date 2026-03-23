/**
 * Benchmark seeding utility.
 * Creates an in-memory better-sqlite3 database populated with N persons in
 * realistic family structures.  Returns the raw Database instance so bench
 * suites can wrap it with drizzle or run raw SQL against it.
 */
import Database from 'better-sqlite3';

const MALE_NAMES = [
  'John', 'William', 'James', 'George', 'Charles',
  'Robert', 'Joseph', 'Thomas', 'Henry', 'Edward',
];

const FEMALE_NAMES = [
  'Mary', 'Anna', 'Emma', 'Elizabeth', 'Margaret',
  'Sarah', 'Alice', 'Helen', 'Grace', 'Ruth',
];

const SURNAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
  'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor',
  'Thomas', 'Jackson', 'White', 'Harris', 'Martin',
  'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark',
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const NOW = '2026-01-01T00:00:00.000Z';

function createSchema(db: Database.Database): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY,
      sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private',
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS person_names (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      name_type TEXT NOT NULL DEFAULT 'birth',
      prefix TEXT,
      given_name TEXT NOT NULL,
      surname TEXT NOT NULL,
      suffix TEXT,
      nickname TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      partner1_id TEXT,
      partner2_id TEXT,
      relationship_type TEXT NOT NULL DEFAULT 'unknown',
      validation_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS children (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      person_id TEXT NOT NULL,
      child_order INTEGER,
      relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
      relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
      validation_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      UNIQUE(family_id, person_id),
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      date_original TEXT,
      date_sort INTEGER,
      date_modifier TEXT DEFAULT 'exact',
      date_end_sort INTEGER,
      place_text TEXT,
      description TEXT,
      person_id TEXT,
      family_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS ancestor_paths (
      ancestor_id TEXT NOT NULL,
      descendant_id TEXT NOT NULL,
      depth INTEGER NOT NULL,
      PRIMARY KEY (ancestor_id, descendant_id)
    )
  `).run();

  db.prepare(`CREATE INDEX IF NOT EXISTS idx_ap_descendant ON ancestor_paths(descendant_id, depth)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_ap_ancestor ON ancestor_paths(ancestor_id, depth)`).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS person_summary (
      person_id TEXT PRIMARY KEY,
      given_name TEXT NOT NULL DEFAULT '',
      surname TEXT NOT NULL DEFAULT '',
      sex TEXT NOT NULL,
      is_living INTEGER NOT NULL,
      birth_date TEXT,
      death_date TEXT,
      birth_date_sort INTEGER,
      death_date_sort INTEGER,
      birth_place TEXT,
      death_place TEXT,
      spouse_count INTEGER NOT NULL DEFAULT 0,
      child_count INTEGER NOT NULL DEFAULT 0,
      parent_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
    )
  `).run();
}

function prepareStatements(db: Database.Database) {
  return {
    insertPerson: db.prepare(
      `INSERT INTO persons (id, sex, is_living, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    ),
    insertName: db.prepare(
      `INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ),
    insertFamily: db.prepare(
      `INSERT INTO families (id, partner1_id, partner2_id, relationship_type, validation_status, created_at, updated_at) VALUES (?, ?, ?, 'married', 'confirmed', ?, ?)`
    ),
    insertChild: db.prepare(
      `INSERT OR IGNORE INTO children (id, family_id, person_id, child_order, created_at) VALUES (?, ?, ?, ?, ?)`
    ),
    insertEvent: db.prepare(
      `INSERT INTO events (id, event_type, date_original, date_sort, date_end_sort, place_text, person_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    findFamily: db.prepare(
      `SELECT id FROM families WHERE partner1_id = ? AND partner2_id = ? ORDER BY rowid DESC LIMIT 1`
    ),
  };
}

/** Insert a single person row and return its id. */
function insertPerson(
  stmts: ReturnType<typeof prepareStatements>,
  sex: 'M' | 'F',
  birthYear: number,
): string {
  const id = crypto.randomUUID();
  const givenName = rand(sex === 'M' ? MALE_NAMES : FEMALE_NAMES);
  const surname = rand(SURNAMES);
  const isLiving = birthYear >= 1960 ? 1 : 0;

  stmts.insertPerson.run(id, sex, isLiving, NOW, NOW);
  stmts.insertName.run(crypto.randomUUID(), id, givenName, surname, 1, NOW);

  const birthSort = birthYear * 10000 + 101;
  stmts.insertEvent.run(crypto.randomUUID(), 'birth', String(birthYear), birthSort, null, null, id, NOW, NOW);

  if (!isLiving) {
    const deathYear = birthYear + 60 + Math.floor(Math.random() * 30);
    const deathSort = deathYear * 10000 + 101;
    stmts.insertEvent.run(crypto.randomUUID(), 'death', String(deathYear), deathSort, null, null, id, NOW, NOW);
  }

  return id;
}

/**
 * Generate a tree of approximately `n` persons using realistic family
 * structures (2-5 children per couple).  Returns the populated Database.
 *
 * The tree is built breadth-first from root couples.  Generation stops once
 * the person count reaches n; the actual count may be slightly above n due to
 * whole-family rounding at the last generation.
 */
export function generateTree(n: number): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  createSchema(db);

  const stmts = prepareStatements(db);

  const fill = db.transaction(() => {
    let personCount = 0;

    // Queue of couples waiting to have children generated
    const pendingCouples: Array<{
      famId: string;
      parent1Id: string;
      parent2Id: string;
      childBirthYear: number;
    }> = [];

    // Seed root couples spread across 1700–1780
    const rootCount = Math.max(1, Math.ceil(n / 80));
    for (let r = 0; r < rootCount && personCount < n; r++) {
      const birthYear = 1700 + Math.floor(Math.random() * 80);
      const p1 = insertPerson(stmts, 'M', birthYear);
      const p2 = insertPerson(stmts, 'F', birthYear + Math.floor(Math.random() * 5));
      personCount += 2;

      const famId = crypto.randomUUID();
      stmts.insertFamily.run(famId, p1, p2, NOW, NOW);
      pendingCouples.push({ famId, parent1Id: p1, parent2Id: p2, childBirthYear: birthYear + 25 });
    }

    // BFS: expand couples until person target is reached
    let qi = 0;
    while (personCount < n && qi < pendingCouples.length) {
      const { famId: parentFamId, parent1Id, parent2Id, childBirthYear } = pendingCouples[qi++];
      const numChildren = 2 + Math.floor(Math.random() * 4); // 2-5

      for (let c = 0; c < numChildren && personCount < n; c++) {
        const yr = childBirthYear + c * 2;
        const sex: 'M' | 'F' = Math.random() < 0.5 ? 'M' : 'F';
        const childId = insertPerson(stmts, sex, yr);
        personCount++;

        stmts.insertChild.run(crypto.randomUUID(), parentFamId, childId, c + 1, NOW);

        // Pair each child with a spouse and enqueue for the next generation
        if (yr + 25 < 2000 && personCount < n) {
          const spouseSex: 'M' | 'F' = sex === 'M' ? 'F' : 'M';
          const spouseId = insertPerson(stmts, spouseSex, yr + 2);
          personCount++;

          const newFamId = crypto.randomUUID();
          const [p1, p2] = sex === 'M' ? [childId, spouseId] : [spouseId, childId];
          stmts.insertFamily.run(newFamId, p1, p2, NOW, NOW);

          pendingCouples.push({
            famId: newFamId,
            parent1Id: p1,
            parent2Id: p2,
            childBirthYear: yr + 25,
          });
        }
      }
    }
  });

  fill();
  return db;
}
