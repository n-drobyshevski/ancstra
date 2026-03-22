import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';

const ANCSTRA_DIR = path.join(os.homedir(), '.ancstra');
const CENTRAL_DB_PATH = path.join(ANCSTRA_DIR, 'ancstra.sqlite');
const FAMILIES_DIR = path.join(ANCSTRA_DIR, 'families');

/**
 * Check if migration is needed.
 * Returns true if the old single-DB exists but central DB does not.
 */
export function needsMigration(oldDbPath: string): boolean {
  return fs.existsSync(oldDbPath) && !fs.existsSync(CENTRAL_DB_PATH);
}

/**
 * Run the single-DB to multi-DB migration.
 * 1. Create ~/.ancstra/ directory structure
 * 2. Create central DB with schema
 * 3. Copy users from old DB to central
 * 4. Create family_registry entry
 * 5. Copy old DB as family-{id}.sqlite
 * 6. In family DB: drop users table, add version columns, create new tables
 * 7. Create family_members row (existing user as owner)
 * 8. Populate family_user_cache
 */
export function migrateToMultiDb(
  oldDbPath: string,
  familyName = 'My Family Tree',
  options?: {
    centralDbPath?: string;
    familiesDir?: string;
  },
): {
  centralDbPath: string;
  familyDbPath: string;
  familyId: string;
} {
  const centralDbPath = options?.centralDbPath ?? CENTRAL_DB_PATH;
  const familiesDir = options?.familiesDir ?? FAMILIES_DIR;
  const ancstraDir = path.dirname(centralDbPath);

  // 1. Create directories
  fs.mkdirSync(ancstraDir, { recursive: true });
  fs.mkdirSync(familiesDir, { recursive: true });

  const familyId = crypto.randomUUID();
  const dbFilename = `family-${familyId}.sqlite`;
  const familyDbPath = path.join(familiesDir, dbFilename);

  // 2. Create central DB
  const centralRaw = new Database(centralDbPath);
  centralRaw.pragma('journal_mode = WAL');
  centralRaw.pragma('foreign_keys = ON');

  centralRaw.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      UNIQUE(provider, provider_account_id)
    );
    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires TEXT NOT NULL,
      PRIMARY KEY (identifier, token)
    );
    CREATE TABLE IF NOT EXISTS family_registry (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      db_filename TEXT NOT NULL,
      moderation_enabled INTEGER NOT NULL DEFAULT 0,
      max_members INTEGER NOT NULL DEFAULT 50,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'editor', 'viewer')),
      invited_role TEXT,
      joined_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT,
      UNIQUE(family_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
      invited_by TEXT NOT NULL REFERENCES users(id),
      email TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      accepted_by TEXT REFERENCES users(id),
      revoked_at TEXT,
      revoked_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activity_feed (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      summary TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 3. Copy users from old DB
  const oldRaw = new Database(oldDbPath, { readonly: true });
  const oldUsers = oldRaw.prepare('SELECT * FROM users').all() as Array<{
    id: string;
    email: string;
    password_hash?: string;
    name?: string;
    created_at?: string;
  }>;
  const now = new Date().toISOString();

  const insertUser = centralRaw.prepare(
    'INSERT INTO users (id, email, password_hash, name, avatar_url, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, 0, ?, ?)',
  );

  for (const user of oldUsers) {
    insertUser.run(
      user.id,
      user.email,
      user.password_hash ?? null,
      user.name || user.email,
      user.created_at || now,
      now,
    );
  }

  // 4. Create family_registry entry
  const ownerId = oldUsers[0]?.id;
  if (!ownerId) {
    centralRaw.close();
    oldRaw.close();
    throw new Error('Cannot migrate: no users found in old database');
  }

  centralRaw
    .prepare(
      'INSERT INTO family_registry (id, name, owner_id, db_filename, moderation_enabled, max_members, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 50, ?, ?)',
    )
    .run(familyId, familyName, ownerId, dbFilename, now, now);

  // 5. Copy old DB as family DB
  oldRaw.close();
  fs.copyFileSync(oldDbPath, familyDbPath);

  // 6. Modify family DB
  const familyRaw = new Database(familyDbPath);
  familyRaw.pragma('journal_mode = WAL');

  // Drop users table from family DB
  familyRaw.exec('DROP TABLE IF EXISTS users');

  // Add version columns to mutable tables (ignore if already exists)
  const tablesToVersion = [
    'persons',
    'person_names',
    'families',
    'children',
    'events',
    'sources',
    'source_citations',
  ];
  for (const table of tablesToVersion) {
    try {
      familyRaw.exec(
        `ALTER TABLE ${table} ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
      );
    } catch {
      // Column may already exist — safe to ignore
    }
  }

  // Create new tables for multi-user support
  familyRaw.exec(`
    CREATE TABLE IF NOT EXISTS family_user_cache (
      user_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar_url TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_contributions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
      entity_type TEXT NOT NULL CHECK(entity_type IN ('person', 'family', 'event', 'source', 'media')),
      entity_id TEXT,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'revision_requested')),
      reviewer_id TEXT,
      review_comment TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_contributions(status);
  `);

  // 7. Create family_members row for each user (first user as owner, rest as editors)
  for (let i = 0; i < oldUsers.length; i++) {
    const user = oldUsers[i]!;
    const role = i === 0 ? 'owner' : 'editor';
    centralRaw.prepare(
      'INSERT INTO family_members (id, family_id, user_id, role, joined_at, is_active) VALUES (?, ?, ?, ?, ?, 1)',
    ).run(crypto.randomUUID(), familyId, user.id, role, now);

    // 8. Populate family_user_cache
    familyRaw
      .prepare(
        'INSERT OR REPLACE INTO family_user_cache (user_id, name, avatar_url, updated_at) VALUES (?, ?, NULL, ?)',
      )
      .run(user.id, user.name || user.email, now);
  }

  centralRaw.close();
  familyRaw.close();

  return { centralDbPath, familyDbPath, familyId };
}
