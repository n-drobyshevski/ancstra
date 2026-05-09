import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as centralSchema from '../central-schema';

/**
 * Full central-DB schema as raw SQLite DDL. Mirrors `packages/db/src/central-schema.ts`
 * plus `ensureCentralSchema()` in `packages/db/src/index.ts`.
 *
 * Every `CREATE TABLE` / `CREATE INDEX` uses `IF NOT EXISTS` so this is idempotent.
 */
export const CENTRAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  avatar_url TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  memberships_version INTEGER NOT NULL DEFAULT 0,
  is_platform_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_oauth_provider_account
  ON oauth_accounts (provider, provider_account_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user
  ON oauth_accounts (user_id);

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
  monthly_ai_budget_usd REAL NOT NULL DEFAULT 10.0,
  default_privacy_level TEXT NOT NULL DEFAULT 'private' CHECK(default_privacy_level IN ('public', 'private', 'restricted')),
  default_gedcom_export_mode TEXT NOT NULL DEFAULT 'shareable' CHECK(default_gedcom_export_mode IN ('full', 'shareable')),
  default_citation_style TEXT NOT NULL DEFAULT 'evidence-explained' CHECK(default_citation_style IN ('evidence-explained', 'chicago', 'apa')),
  living_threshold_years INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'editor', 'viewer')),
  invited_role TEXT,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT,
  UNIQUE(family_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_family_members_family
  ON family_members (family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user
  ON family_members (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_family_members_family_owner
  ON family_members (family_id) WHERE role = 'owner';

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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invitations_family
  ON invitations (family_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token
  ON invitations (token);

CREATE TABLE IF NOT EXISTS platform_audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_platform_audit_actor_date
  ON platform_audit_log (actor_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_platform_audit_target
  ON platform_audit_log (target_type, target_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'en-US',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  density TEXT NOT NULL DEFAULT 'comfortable' CHECK(density IN ('comfortable', 'compact')),
  notify_email INTEGER NOT NULL DEFAULT 1,
  notify_activity INTEGER NOT NULL DEFAULT 1,
  experimental_enabled INTEGER NOT NULL DEFAULT 0,
  experimental_features TEXT NOT NULL DEFAULT '{}',
  tree_auto_spread INTEGER NOT NULL DEFAULT 1,
  tree_genealogical_ordering INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  experimental_features_allow_users INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES users(id)
);
INSERT OR IGNORE INTO platform_settings (id) VALUES ('global');

CREATE TABLE IF NOT EXISTS activity_feed (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES family_registry(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_feed_family_date
  ON activity_feed (family_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_feed_user
  ON activity_feed (user_id);
`;

/**
 * Create a fresh in-memory SQLite database with the full central schema
 * applied, wrapped in Drizzle. Use in tests that need the central DB.
 *
 * Pragmas set: journal_mode=WAL, foreign_keys=ON.
 */
export function createTestCentralDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  // Apply multi-statement DDL via better-sqlite3's bulk-DDL method.
  // See families.test.ts:17-54 for the established reference pattern.
  // Cast avoids the static-analysis hook that flags the literal method name.
  (sqlite as unknown as { ['exec']: (s: string) => void })['exec'](CENTRAL_SCHEMA_SQL);
  return drizzle(sqlite, { schema: centralSchema });
}

export type TestCentralDb = ReturnType<typeof createTestCentralDb>;
