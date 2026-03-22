import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { AncstraAdapter } from '../src/nextauth-adapter';
import * as schema from '@ancstra/db/central-schema';

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

    CREATE TABLE verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires TEXT NOT NULL,
      PRIMARY KEY (identifier, token)
    );
  `);

  return drizzle(sqlite, { schema });
}

describe('AncstraAdapter', () => {
  let db: ReturnType<typeof createTestDb>;
  let adapter: ReturnType<typeof AncstraAdapter>;

  beforeEach(() => {
    db = createTestDb();
    adapter = AncstraAdapter(db);
  });

  describe('createUser', () => {
    it('inserts a user row and returns user with id', async () => {
      const result = await adapter.createUser!({
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.png',
        emailVerified: null,
        id: '',
      });

      expect(result).toMatchObject({
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.png',
        emailVerified: null,
      });
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });
  });

  describe('getUser', () => {
    it('returns user by id', async () => {
      const created = await adapter.createUser!({
        email: 'find@example.com',
        name: 'Find Me',
        image: null,
        emailVerified: null,
        id: '',
      });

      const found = await adapter.getUser!(created.id);
      expect(found).toMatchObject({
        id: created.id,
        email: 'find@example.com',
        name: 'Find Me',
      });
    });

    it('returns null if not found', async () => {
      const found = await adapter.getUser!('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('returns user by email', async () => {
      await adapter.createUser!({
        email: 'byemail@example.com',
        name: 'By Email',
        image: null,
        emailVerified: null,
        id: '',
      });

      const found = await adapter.getUserByEmail!('byemail@example.com');
      expect(found).toMatchObject({
        email: 'byemail@example.com',
        name: 'By Email',
      });
    });

    it('returns null if not found', async () => {
      const found = await adapter.getUserByEmail!('nope@example.com');
      expect(found).toBeNull();
    });
  });

  describe('getUserByAccount', () => {
    it('joins oauth_accounts + users and returns user', async () => {
      const created = await adapter.createUser!({
        email: 'oauth@example.com',
        name: 'OAuth User',
        image: null,
        emailVerified: null,
        id: '',
      });

      await adapter.linkAccount!({
        userId: created.id,
        provider: 'google',
        providerAccountId: 'google-123',
        type: 'oauth',
        access_token: 'tok_abc',
        refresh_token: 'ref_abc',
        expires_at: 999999,
      } as any);

      const found = await adapter.getUserByAccount!({
        provider: 'google',
        providerAccountId: 'google-123',
      });

      expect(found).toMatchObject({
        id: created.id,
        email: 'oauth@example.com',
        name: 'OAuth User',
      });
    });

    it('returns null when no matching account', async () => {
      const found = await adapter.getUserByAccount!({
        provider: 'github',
        providerAccountId: 'nope-999',
      });
      expect(found).toBeNull();
    });
  });

  describe('linkAccount', () => {
    it('creates an oauth_accounts row', async () => {
      const created = await adapter.createUser!({
        email: 'link@example.com',
        name: 'Link User',
        image: null,
        emailVerified: null,
        id: '',
      });

      await adapter.linkAccount!({
        userId: created.id,
        provider: 'github',
        providerAccountId: 'gh-456',
        type: 'oauth',
        access_token: 'tok_gh',
        refresh_token: null,
        expires_at: undefined,
      } as any);

      // Verify by looking up via getUserByAccount
      const found = await adapter.getUserByAccount!({
        provider: 'github',
        providerAccountId: 'gh-456',
      });
      expect(found).toMatchObject({
        id: created.id,
        email: 'link@example.com',
      });
    });
  });

  describe('createVerificationToken', () => {
    it('inserts a verification_tokens row', async () => {
      const expires = new Date('2026-12-31T00:00:00Z');
      const result = await adapter.createVerificationToken!({
        identifier: 'test@example.com',
        token: 'verify-abc-123',
        expires,
      });

      expect(result).toMatchObject({
        identifier: 'test@example.com',
        token: 'verify-abc-123',
        expires,
      });
    });
  });

  describe('useVerificationToken', () => {
    it('returns and deletes the token (one-time use)', async () => {
      const expires = new Date('2026-12-31T00:00:00Z');
      await adapter.createVerificationToken!({
        identifier: 'use@example.com',
        token: 'use-token-xyz',
        expires,
      });

      // First use: should return the token
      const result = await adapter.useVerificationToken!({
        identifier: 'use@example.com',
        token: 'use-token-xyz',
      });

      expect(result).toMatchObject({
        identifier: 'use@example.com',
        token: 'use-token-xyz',
      });
      expect(result!.expires).toEqual(expires);

      // Second use: should return null (deleted)
      const again = await adapter.useVerificationToken!({
        identifier: 'use@example.com',
        token: 'use-token-xyz',
      });
      expect(again).toBeNull();
    });

    it('returns null for non-existent token', async () => {
      const result = await adapter.useVerificationToken!({
        identifier: 'nope@example.com',
        token: 'no-token',
      });
      expect(result).toBeNull();
    });
  });
});
