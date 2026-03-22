import { eq } from 'drizzle-orm';
import * as centralSchema from '@ancstra/db/central-schema';

// Accept any Drizzle DB instance (works with both better-sqlite3 and libsql drivers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CentralDb = any;

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

export async function linkOrCreateUser(centralDb: CentralDb, profile: OAuthProfile): Promise<LinkedUser> {
  const { email, name, avatarUrl, provider, providerAccountId, accessToken, refreshToken, expiresAt } = profile;

  // Apple relay emails should never auto-link — always create a new user
  if (!isAppleRelay(email)) {
    const existing = await centralDb
      .select()
      .from(centralSchema.users)
      .where(eq(centralSchema.users.email, email))
      .get();

    if (existing) {
      // Link OAuth account to existing user
      await centralDb.insert(centralSchema.oauthAccounts).values({
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
        await centralDb.update(centralSchema.users)
          .set(updates)
          .where(eq(centralSchema.users.id, existing.id))
          .run();

        // Re-fetch to return updated user
        return await centralDb
          .select()
          .from(centralSchema.users)
          .where(eq(centralSchema.users.id, existing.id))
          .get()!;
      }

      return existing;
    }
  }

  // Create new user (password_hash = null for OAuth-only)
  const newUser = await centralDb.insert(centralSchema.users).values({
    email,
    name: name ?? email.split('@')[0],
    avatarUrl: avatarUrl ?? null,
    passwordHash: null,
    emailVerified: 1, // OAuth emails are pre-verified
  }).returning().get();

  // Create OAuth account link
  await centralDb.insert(centralSchema.oauthAccounts).values({
    userId: newUser.id,
    provider,
    providerAccountId,
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
    expiresAt: expiresAt ?? null,
  }).run();

  return newUser;
}
