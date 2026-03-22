import type { Adapter, AdapterUser, AdapterAccount } from 'next-auth/adapters';
import { eq, and } from 'drizzle-orm';
import { users, oauthAccounts, verificationTokens } from '@ancstra/db/central-schema';

type CentralDb = Parameters<typeof users._.columns.id.mapFromDriverValue> extends never
  ? any
  : any;

/** Map a DB user row to NextAuth's AdapterUser shape. */
function toAdapterUser(row: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: number;
}): AdapterUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.avatarUrl ?? null,
    emailVerified: row.emailVerified === 1 ? new Date() : null,
  };
}

export function AncstraAdapter(centralDb: any): Adapter {
  return {
    async createUser(user) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await centralDb.insert(users).values({
        id,
        email: user.email,
        name: user.name ?? user.email,
        avatarUrl: user.image ?? null,
        emailVerified: user.emailVerified ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      });

      const row = await centralDb
        .select()
        .from(users)
        .where(eq(users.id, id))
        .get();

      return toAdapterUser(row);
    },

    async getUser(id) {
      const row = await centralDb
        .select()
        .from(users)
        .where(eq(users.id, id))
        .get();

      return row ? toAdapterUser(row) : null;
    },

    async getUserByEmail(email) {
      const row = await centralDb
        .select()
        .from(users)
        .where(eq(users.email, email))
        .get();

      return row ? toAdapterUser(row) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const row = await centralDb
        .select({ user: users })
        .from(oauthAccounts)
        .innerJoin(users, eq(oauthAccounts.userId, users.id))
        .where(
          and(
            eq(oauthAccounts.provider, provider),
            eq(oauthAccounts.providerAccountId, providerAccountId),
          ),
        )
        .get();

      return row ? toAdapterUser(row.user) : null;
    },

    async linkAccount(account) {
      await centralDb.insert(oauthAccounts).values({
        id: crypto.randomUUID(),
        userId: account.userId,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        accessToken: account.access_token ?? null,
        refreshToken: account.refresh_token ?? null,
        expiresAt: account.expires_at ?? null,
      });
    },

    async createVerificationToken(token) {
      await centralDb.insert(verificationTokens).values({
        identifier: token.identifier,
        token: token.token,
        expires: token.expires.toISOString(),
      });

      return {
        identifier: token.identifier,
        token: token.token,
        expires: token.expires,
      };
    },

    async useVerificationToken({ identifier, token }) {
      const row = await centralDb
        .select()
        .from(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, identifier),
            eq(verificationTokens.token, token),
          ),
        )
        .get();

      if (!row) return null;

      await centralDb
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, identifier),
            eq(verificationTokens.token, token),
          ),
        );

      return {
        identifier: row.identifier,
        token: row.token,
        expires: new Date(row.expires),
      };
    },

    async updateUser(user) {
      if (!user.id) throw new Error('User id is required for updateUser');

      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (user.name !== undefined) updates.name = user.name;
      if (user.email !== undefined) updates.email = user.email;
      if (user.image !== undefined) updates.avatarUrl = user.image;
      if (user.emailVerified !== undefined) {
        updates.emailVerified = user.emailVerified ? 1 : 0;
      }

      await centralDb
        .update(users)
        .set(updates)
        .where(eq(users.id, user.id));

      const row = await centralDb
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .get();

      return toAdapterUser(row);
    },
  };
}
