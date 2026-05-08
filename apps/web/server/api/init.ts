import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { createFamilyDb, type CentralDatabase, type FamilyDatabase } from '@ancstra/db';
import { getCentralDb } from '@/lib/db-singleton';
import { parseRole, effectiveRole, type Role, type Permission } from '@ancstra/auth';
import {
  LENS_COOKIE_NAME,
  parseLensCookie,
  readCookieValue,
} from '@/lib/lens/cookie';

export interface Meta {
  permission?: Permission;
  span?: string;
}

export interface BaseContext {
  session: Session | null;
  userId: string | null;
  familyId: string | null;
  /**
   * Effective role for permission decisions. Equal to `actualRole` unless the
   * user has activated a lens that legitimately downgrades their permissions
   * for the current family.
   */
  role: Role | null;
  /**
   * Real role from the JWT membership, untouched by any lens. Use only for
   * UI affordances that need to know the user's true role (e.g. the lens
   * selector itself). Never use for permission decisions.
   */
  actualRole: Role | null;
  dbFilename: string | null;
  familyDb: FamilyDatabase | null;
  centralDb: CentralDatabase;
}

export async function createTRPCContext(opts: { headers: Headers }): Promise<BaseContext> {
  const session = await auth();
  const centralDb = await getCentralDb();

  if (!session?.user?.id) {
    return {
      session,
      userId: null,
      familyId: null,
      role: null,
      actualRole: null,
      dbFilename: null,
      familyDb: null,
      centralDb,
    };
  }

  const familyHint = opts.headers.get('x-family-id');
  const memberships = session.user.memberships ?? [];
  const membership = familyHint
    ? memberships.find((m) => m.familyId === familyHint)
    : memberships[0];

  if (!membership) {
    return {
      session,
      userId: session.user.id,
      familyId: null,
      role: null,
      actualRole: null,
      dbFilename: null,
      familyDb: null,
      centralDb,
    };
  }

  const actualRole = parseRole(membership.role);
  if (!actualRole) {
    // Treat malformed role as "no membership" — fail closed
    return {
      session,
      userId: session.user.id,
      familyId: null,
      role: null,
      actualRole: null,
      dbFilename: null,
      familyDb: null,
      centralDb,
    };
  }

  // Lens system: read the cookie (untrusted) and apply ONLY if it requests a
  // strict downgrade for the current family. Source of truth is JWT membership;
  // see security note from cross-cutting D2 — we never accept role escalation
  // from the client.
  const cookieHeader = opts.headers.get('cookie');
  const lensRaw = cookieHeader ? readCookieValue(cookieHeader, LENS_COOKIE_NAME) : null;
  const parsed = parseLensCookie(lensRaw);
  const lensRequest =
    parsed && parsed.familyId === membership.familyId ? parsed.role : null;
  const role = effectiveRole(actualRole, lensRequest);

  const familyDb = createFamilyDb(membership.dbFilename);
  return {
    session,
    userId: session.user.id,
    familyId: membership.familyId,
    // ctx.role is the EFFECTIVE role (lens-aware). All permission middleware
    // keys off this value. ctx.actualRole holds the JWT-derived real role for
    // UI affordances like the lens selector.
    role,
    actualRole,
    dbFilename: membership.dbFilename,
    familyDb,
    centralDb,
  };
}

export const t = initTRPC.context<BaseContext>().meta<Meta>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.issues : null,
      },
    };
  },
});
