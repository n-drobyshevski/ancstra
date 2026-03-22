import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { migrateToMultiDb } from '../src/migrations/split-to-multi-db';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ancstra-migration-test-'));
}

function createOldStyleDb(dbPath: string) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private',
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE person_names (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      name_type TEXT NOT NULL DEFAULT 'birth',
      prefix TEXT,
      given_name TEXT NOT NULL,
      surname TEXT NOT NULL,
      suffix TEXT,
      nickname TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE families (
      id TEXT PRIMARY KEY,
      partner1_id TEXT REFERENCES persons(id),
      partner2_id TEXT REFERENCES persons(id),
      relationship_type TEXT NOT NULL DEFAULT 'unknown',
      validation_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE children (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      child_order INTEGER,
      relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
      relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
      validation_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      date_original TEXT,
      date_sort INTEGER,
      place_text TEXT,
      description TEXT,
      person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE source_citations (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      citation_detail TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium',
      person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Insert sample data
  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('user-1', 'alice@example.com', 'hash123', 'Alice Smith', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z');

  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('user-2', 'bob@example.com', 'hash456', 'Bob Jones', '2025-02-01T00:00:00Z', '2025-02-01T00:00:00Z');

  db.prepare(
    'INSERT INTO persons (id, sex, is_living, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run('person-1', 'M', 1, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z');

  db.prepare(
    'INSERT INTO persons (id, sex, is_living, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run('person-2', 'F', 0, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z');

  db.prepare(
    'INSERT INTO person_names (id, person_id, given_name, surname, is_primary) VALUES (?, ?, ?, ?, ?)',
  ).run('name-1', 'person-1', 'John', 'Doe', 1);

  db.prepare(
    'INSERT INTO person_names (id, person_id, given_name, surname, is_primary) VALUES (?, ?, ?, ?, ?)',
  ).run('name-2', 'person-2', 'Jane', 'Doe', 1);

  db.prepare(
    'INSERT INTO events (id, event_type, date_original, person_id) VALUES (?, ?, ?, ?)',
  ).run('event-1', 'birth', '1 Jan 1950', 'person-1');

  db.close();
}

describe('split-to-multi-db migration', () => {
  let tempDir: string;
  let oldDbPath: string;
  let centralDbPath: string;
  let familiesDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    oldDbPath = path.join(tempDir, 'ancstra.db');
    centralDbPath = path.join(tempDir, 'central', 'ancstra.sqlite');
    familiesDir = path.join(tempDir, 'central', 'families');
    createOldStyleDb(oldDbPath);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create central DB with users and family_registry', () => {
    const result = migrateToMultiDb(oldDbPath, 'Test Family', {
      centralDbPath,
      familiesDir,
    });

    expect(fs.existsSync(result.centralDbPath)).toBe(true);

    const central = new Database(result.centralDbPath, { readonly: true });

    // Check users were copied
    const users = central.prepare('SELECT * FROM users ORDER BY id').all() as Array<{ id: string; email: string; name: string }>;
    expect(users).toHaveLength(2);
    expect(users[0]!.id).toBe('user-1');
    expect(users[0]!.email).toBe('alice@example.com');
    expect(users[0]!.name).toBe('Alice Smith');
    expect(users[1]!.id).toBe('user-2');
    expect(users[1]!.email).toBe('bob@example.com');

    // Check family_registry was created
    const families = central.prepare('SELECT * FROM family_registry').all() as Array<{ id: string; name: string; owner_id: string; db_filename: string }>;
    expect(families).toHaveLength(1);
    expect(families[0]!.name).toBe('Test Family');
    expect(families[0]!.owner_id).toBe('user-1');
    expect(families[0]!.id).toBe(result.familyId);
    expect(families[0]!.db_filename).toContain('family-');

    central.close();
  });

  it('should create family DB without users table', () => {
    const result = migrateToMultiDb(oldDbPath, 'Test Family', {
      centralDbPath,
      familiesDir,
    });

    expect(fs.existsSync(result.familyDbPath)).toBe(true);

    const family = new Database(result.familyDbPath, { readonly: true });

    // Users table should NOT exist in family DB
    const tables = family
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .all();
    expect(tables).toHaveLength(0);

    // Persons data should still be there
    const persons = family.prepare('SELECT * FROM persons ORDER BY id').all() as Array<{ id: string; sex: string }>;
    expect(persons).toHaveLength(2);
    expect(persons[0]!.id).toBe('person-1');
    expect(persons[0]!.sex).toBe('M');

    // Person names should be preserved
    const names = family.prepare('SELECT * FROM person_names ORDER BY id').all() as Array<{ id: string; given_name: string; surname: string }>;
    expect(names).toHaveLength(2);
    expect(names[0]!.given_name).toBe('John');
    expect(names[0]!.surname).toBe('Doe');

    // Events should be preserved
    const events = family.prepare('SELECT * FROM events').all();
    expect(events).toHaveLength(1);

    family.close();
  });

  it('should add version columns to family DB tables', () => {
    const result = migrateToMultiDb(oldDbPath, 'Test Family', {
      centralDbPath,
      familiesDir,
    });

    const family = new Database(result.familyDbPath, { readonly: true });

    const tablesWithVersion = [
      'persons',
      'person_names',
      'families',
      'children',
      'events',
      'sources',
      'source_citations',
    ];

    for (const table of tablesWithVersion) {
      const columns = family.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      const columnNames = columns.map((c) => c.name);
      expect(columnNames, `${table} should have version column`).toContain('version');
    }

    // Check version defaults to 1
    const persons = family.prepare('SELECT version FROM persons').all() as Array<{ version: number }>;
    expect(persons[0]!.version).toBe(1);

    family.close();
  });

  it('should create family_user_cache and pending_contributions tables', () => {
    const result = migrateToMultiDb(oldDbPath, 'Test Family', {
      centralDbPath,
      familiesDir,
    });

    const family = new Database(result.familyDbPath, { readonly: true });

    // Check family_user_cache exists and is populated
    const cache = family.prepare('SELECT * FROM family_user_cache ORDER BY user_id').all() as Array<{ user_id: string; name: string }>;
    expect(cache).toHaveLength(2);
    expect(cache[0]!.user_id).toBe('user-1');
    expect(cache[0]!.name).toBe('Alice Smith');
    expect(cache[1]!.user_id).toBe('user-2');
    expect(cache[1]!.name).toBe('Bob Jones');

    // Check pending_contributions table exists
    const tables = family
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_contributions'")
      .all();
    expect(tables).toHaveLength(1);

    family.close();
  });

  it('should create family_members with correct roles', () => {
    const result = migrateToMultiDb(oldDbPath, 'Test Family', {
      centralDbPath,
      familiesDir,
    });

    const central = new Database(result.centralDbPath, { readonly: true });

    const members = central
      .prepare('SELECT * FROM family_members WHERE family_id = ? ORDER BY role')
      .all(result.familyId) as Array<{ user_id: string; role: string; is_active: number }>;

    expect(members).toHaveLength(2);

    const owner = members.find((m) => m.role === 'owner');
    const editor = members.find((m) => m.role === 'editor');

    expect(owner).toBeDefined();
    expect(owner!.user_id).toBe('user-1');
    expect(owner!.is_active).toBe(1);

    expect(editor).toBeDefined();
    expect(editor!.user_id).toBe('user-2');
    expect(editor!.is_active).toBe(1);

    central.close();
  });

  it('should return correct paths and familyId', () => {
    const result = migrateToMultiDb(oldDbPath, 'Test Family', {
      centralDbPath,
      familiesDir,
    });

    expect(result.centralDbPath).toBe(centralDbPath);
    expect(result.familyDbPath).toContain(familiesDir);
    expect(result.familyDbPath).toContain(result.familyId);
    expect(typeof result.familyId).toBe('string');
    expect(result.familyId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
