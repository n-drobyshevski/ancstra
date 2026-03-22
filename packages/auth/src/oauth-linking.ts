import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as centralSchema from '@ancstra/db/central-schema';

type CentralDb = BetterSQLite3Database<typeof centralSchema>;

export interface OAuthProfile {
  email: string;
  name?: string;
  avatarUrl?: string;
  provider: string;
  providerAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface LinkedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: number;
  createdAt: string;
  updatedAt: string;
}

export function isAppleRelay(email: string): boolean {
  return email.endsWith('@privaterelay.appleid.com');
}

export function linkOrCreateUser(centralDb: CentralDb, profile: OAuthProfile): LinkedUser {
  const { email, name, avatarUrl, provider, providerAccountId, accessToken, refreshToken, expiresAt } = profile;

  // Apple relay emails should never auto-link — always create a new user
  if (!isAppleRelay(email)) {
    const existing = centralDb
      .select()
      .from(centralSchema.users)
      .where(eq(centralSchema.users.email, email))
      .get();

    if (existing) {
      // Link OAuth account to existing user
      centralDb.insert(centralSchema.oauthAccounts).values({
        userId: existing.id,
        provider,
        providerAccountId,
        accessToken: accessToken ?? null,
        refreshToken: refreshToken ?? null,
        expiresAt: expiresAt ?? null,
      }).run();

      // Merge missing name/avatar — do NOT overwrite existing values
      const updates: Record<string, string> = {};
      if (!existing.name && name) {
        updates.name = name;
      }
      if (!existing.avatarUrl && avatarUrl) {
        updates.avatarUrl = avatarUrl;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date().toISOString();
        centralDb.update(centralSchema.users)
          .set(updates)
          .where(eq(centralSchema.users.id, existing.id))
          .run();

        // Re-fetch to return updated user
        return centralDb
          .select()
          .from(centralSchema.users)
          .where(eq(centralSchema.users.id, existing.id))
          .get()!;
      }

      return existing;
    }
  }

  // Create new user (password_hash = null for OAuth-only)
  const newUser = centralDb.insert(centralSchema.users).values({
    email,
    name: name ?? email.split('@')[0],
    avatarUrl: avatarUrl ?? null,
    passwordHash: null,
    emailVerified: 1, // OAuth emails are pre-verified
  }).returning().get();

  // Create OAuth account link
  centralDb.insert(centralSchema.oauthAccounts).values({
    userId: newUser.id,
    provider,
    providerAccountId,
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
    expiresAt: expiresAt ?? null,
  }).run();

  return newUser;
}
