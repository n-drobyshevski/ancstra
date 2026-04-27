import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Apple from 'next-auth/providers/apple';
import type { Provider } from 'next-auth/providers';
import { createCentralDb } from '@ancstra/db';
import { centralSchema } from '@ancstra/db';
import { and, eq } from 'drizzle-orm';
import type { FamilyMembership } from '@/types/next-auth';
import bcrypt from 'bcryptjs';
import { AncstraAdapter } from '@ancstra/auth';
import { linkOrCreateUser } from '@ancstra/auth';

// Lazy init — don't create DB connection at import time (breaks Vercel build)
let _centralDb: ReturnType<typeof createCentralDb> | null = null;
function getCentralDb() {
  if (!_centralDb) _centralDb = createCentralDb();
  return _centralDb;
}

// Build providers list dynamically — skip OAuth providers if env vars missing
const providers: Provider[] = [
  Credentials({
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    authorize: async (credentials) => {
      try {
        const email = credentials?.email as string;
        const password = credentials?.password as string;

        if (!email || !password) return null;

        const db = getCentralDb();
        const users = await db
          .select()
          .from(centralSchema.users)
          .where(eq(centralSchema.users.email, email))
          .all();

        const user = users[0];
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      } catch (error) {
        console.error('[AUTH] Error in authorize:', error);
        return null;
      }
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }));
}

if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(Apple({
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
  }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Only use adapter at runtime (not during build — no DB available on Vercel build)
  ...(process.env.CENTRAL_DATABASE_URL ? { adapter: AncstraAdapter(getCentralDb()) } : {}),
  providers,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.userId = user.id;
      }
      // Populate memberships on initial sign-in or when explicitly refreshed
      // (e.g. after creating/joining a family). Embedding membership info in
      // the JWT lets the proxy forward role + dbFilename as headers, so
      // getAuthContext() in server components is a pure header read.
      const shouldRefresh =
        Boolean(user) ||
        trigger === 'update' ||
        (token.userId && !token.memberships);
      if (shouldRefresh && token.userId) {
        try {
          const db = getCentralDb();
          const memberships = await db
            .select({
              familyId: centralSchema.familyMembers.familyId,
              role: centralSchema.familyMembers.role,
              dbFilename: centralSchema.familyRegistry.dbFilename,
            })
            .from(centralSchema.familyMembers)
            .innerJoin(
              centralSchema.familyRegistry,
              eq(centralSchema.familyMembers.familyId, centralSchema.familyRegistry.id),
            )
            .where(
              and(
                eq(centralSchema.familyMembers.userId, token.userId as string),
                eq(centralSchema.familyMembers.isActive, 1),
              ),
            )
            .all();
          token.memberships = memberships as FamilyMembership[];
        } catch (error) {
          console.error('[AUTH] Error loading memberships into JWT:', error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      if (token.memberships) {
        session.user.memberships = token.memberships;
      }
      return session;
    },
  },
});
