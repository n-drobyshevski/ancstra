import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as centralSchema from '@ancstra/db/central-schema';
import { linkOrCreateUser, isAppleRelay } from '../src/oauth-linking';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE oauth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      UNIQUE(provider, provider_account_id)
    );
    CREATE INDEX idx_oauth_accounts_user ON oauth_accounts(user_id);
  `);
  return drizzle(sqlite, { schema: centralSchema });
}

describe('isAppleRelay', () => {
  it('returns true for @privaterelay.appleid.com addresses', () => {
    expect(isAppleRelay('abc123@privaterelay.appleid.com')).toBe(true);
  });

  it('returns false for regular email addresses', () => {
    expect(isAppleRelay('user@gmail.com')).toBe(false);
    expect(isAppleRelay('user@apple.com')).toBe(false);
  });
});

describe('linkOrCreateUser', () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it('when email matches existing user: links oauth account and returns existing user', () => {
    // Seed an existing user with name and avatar
    db.insert(centralSchema.users).values({
      id: 'existing-user-1',
      email: 'alice@example.com',
      name: 'Alice Smith',
      avatarUrl: 'https://example.com/alice.jpg',
      passwordHash: 'hashed-pw',
      emailVerified: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }).run();

    const result = linkOrCreateUser(db, {
      email: 'alice@example.com',
      name: 'Alice OAuth Name',
      avatarUrl: 'https://oauth.com/alice-new.jpg',
      provider: 'google',
      providerAccountId: 'google-123',
      accessToken: 'at-123',
    });

    // Should return the existing user, NOT overwrite name/avatar
    expect(result.id).toBe('existing-user-1');
    expect(result.name).toBe('Alice Smith');
    expect(result.avatarUrl).toBe('https://example.com/alice.jpg');

    // Should have created an oauth_accounts row
    const oauthRows = db.select().from(centralSchema.oauthAccounts)
      .where(eq(centralSchema.oauthAccounts.userId, 'existing-user-1'))
      .all();
    expect(oauthRows).toHaveLength(1);
    expect(oauthRows[0].provider).toBe('google');
    expect(oauthRows[0].providerAccountId).toBe('google-123');
    expect(oauthRows[0].accessToken).toBe('at-123');
  });

  it('when email matches existing user with missing name/avatar: merges them', () => {
    // Seed a user with empty-ish name and no avatar
    db.insert(centralSchema.users).values({
      id: 'existing-user-2',
      email: 'bob@example.com',
      name: '',
      avatarUrl: null,
      passwordHash: null,
      emailVerified: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }).run();

    const result = linkOrCreateUser(db, {
      email: 'bob@example.com',
      name: 'Bob OAuth',
      avatarUrl: 'https://oauth.com/bob.jpg',
      provider: 'github',
      providerAccountId: 'gh-456',
    });

    expect(result.id).toBe('existing-user-2');
    // Empty string is falsy, so name should be merged
    expect(result.name).toBe('Bob OAuth');
    expect(result.avatarUrl).toBe('https://oauth.com/bob.jpg');
  });

  it('when email is new: creates user with password_hash=null and oauth_accounts row', () => {
    const result = linkOrCreateUser(db, {
      email: 'charlie@example.com',
      name: 'Charlie New',
      avatarUrl: 'https://oauth.com/charlie.jpg',
      provider: 'google',
      providerAccountId: 'google-789',
      accessToken: 'at-789',
      refreshToken: 'rt-789',
      expiresAt: 1700000000,
    });

    // Should create a new user
    expect(result.email).toBe('charlie@example.com');
    expect(result.name).toBe('Charlie New');
    expect(result.avatarUrl).toBe('https://oauth.com/charlie.jpg');
    expect(result.id).toBeTruthy();

    // Verify password_hash is null in DB
    const userRow = db.select().from(centralSchema.users)
      .where(eq(centralSchema.users.email, 'charlie@example.com'))
      .get();
    expect(userRow!.passwordHash).toBeNull();
    expect(userRow!.emailVerified).toBe(1);

    // Verify oauth_accounts row
    const oauthRows = db.select().from(centralSchema.oauthAccounts)
      .where(eq(centralSchema.oauthAccounts.userId, result.id))
      .all();
    expect(oauthRows).toHaveLength(1);
    expect(oauthRows[0].provider).toBe('google');
    expect(oauthRows[0].providerAccountId).toBe('google-789');
    expect(oauthRows[0].accessToken).toBe('at-789');
    expect(oauthRows[0].refreshToken).toBe('rt-789');
    expect(oauthRows[0].expiresAt).toBe(1700000000);
  });

  it('when Apple relay email: always creates new user (no auto-link)', () => {
    const newRelayEmail = 'def456@privaterelay.appleid.com';
    const result = linkOrCreateUser(db, {
      email: newRelayEmail,
      name: 'New Apple User',
      provider: 'apple',
      providerAccountId: 'apple-999',
    });

    expect(result.email).toBe(newRelayEmail);
    expect(result.name).toBe('New Apple User');

    // Verify user was created (not linked to any existing)
    const allUsers = db.select().from(centralSchema.users).all();
    expect(allUsers).toHaveLength(1);
    expect(allUsers[0].passwordHash).toBeNull();

    // Verify oauth account was created
    const oauthRows = db.select().from(centralSchema.oauthAccounts)
      .where(eq(centralSchema.oauthAccounts.userId, result.id))
      .all();
    expect(oauthRows).toHaveLength(1);
    expect(oauthRows[0].provider).toBe('apple');
  });

  it('when new user with no name provided: uses email prefix as name', () => {
    const result = linkOrCreateUser(db, {
      email: 'dave@example.com',
      provider: 'google',
      providerAccountId: 'google-abc',
    });

    expect(result.name).toBe('dave');
  });
});
