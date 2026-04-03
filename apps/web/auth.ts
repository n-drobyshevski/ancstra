import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Apple from 'next-auth/providers/apple';
import type { Provider } from 'next-auth/providers';
import { createCentralDb } from '@ancstra/db';
import { centralSchema } from '@ancstra/db';
import { eq } from 'drizzle-orm';
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
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
