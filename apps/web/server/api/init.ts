import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { createCentralDb, createFamilyDb, type CentralDatabase, type FamilyDatabase } from '@ancstra/db';
import type { Role } from '@ancstra/auth';
import { VALID_ROLES } from '@ancstra/auth';

function parseRole(s: string): Role | null {
  return (VALID_ROLES as readonly string[]).includes(s) ? (s as Role) : null;
}

export interface Meta {
  permission?: string;
  span?: string;
}

export interface BaseContext {
  session: Session | null;
  userId: string | null;
  familyId: string | null;
  role: Role | null;
  dbFilename: string | null;
  familyDb: FamilyDatabase | null;
  centralDb: CentralDatabase;
}

export async function createTRPCContext(opts: { headers: Headers }): Promise<BaseContext> {
  const session = await auth();
  const centralDb = createCentralDb();

  if (!session?.user?.id) {
    return {
      session,
      userId: null,
      familyId: null,
      role: null,
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
      dbFilename: null,
      familyDb: null,
      centralDb,
    };
  }

  const role = parseRole(membership.role);
  if (!role) {
    // Treat malformed role as "no membership" — fail closed
    return {
      session,
      userId: session.user.id,
      familyId: null,
      role: null,
      dbFilename: null,
      familyDb: null,
      centralDb,
    };
  }

  const familyDb = createFamilyDb(membership.dbFilename);
  return {
    session,
    userId: session.user.id,
    familyId: membership.familyId,
    // role re-derived from JWT membership; never trust x-family-role header (cross-cutting D2)
    role,
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
