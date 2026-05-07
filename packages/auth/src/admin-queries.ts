import { eq, and, or, like, sql, count, isNull, desc, gte, gt, lt, lte } from 'drizzle-orm';
import * as centralSchema from '@ancstra/db/central-schema';

// Accept any Drizzle DB instance — same convention as invitations.ts/families.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CentralDb = any;

// ====================================================================
// User listing & detail
// ====================================================================

export interface UserListRow {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isPlatformAdmin: boolean;
  emailVerified: boolean;
  familyCount: number;
  ownedFamilyCount: number;
  createdAt: string;
}

export interface ListAllUsersOpts {
  q?: string;
  offset?: number;
  limit?: number;
}

/**
 * List all users with active-membership and ownership counts.
 * Search matches email or name (case-insensitive substring).
 */
export async function listAllUsers(
  centralDb: CentralDb,
  opts: ListAllUsersOpts = {},
): Promise<{ rows: UserListRow[]; total: number }> {
  const { q, offset = 0, limit = 50 } = opts;
  const search = q?.trim();

  const whereClause = search
    ? or(
        like(centralSchema.users.email, `%${search}%`),
        like(centralSchema.users.name, `%${search}%`),
      )
    : undefined;

  const totalRow = await centralDb
    .select({ n: count() })
    .from(centralSchema.users)
    .where(whereClause ?? sql`1=1`)
    .get();

  const rows = await centralDb
    .select({
      id: centralSchema.users.id,
      email: centralSchema.users.email,
      name: centralSchema.users.name,
      avatarUrl: centralSchema.users.avatarUrl,
      isPlatformAdmin: centralSchema.users.isPlatformAdmin,
      emailVerified: centralSchema.users.emailVerified,
      createdAt: centralSchema.users.createdAt,
      familyCount: sql<number>`(
        SELECT COUNT(*) FROM ${centralSchema.familyMembers}
        WHERE ${centralSchema.familyMembers.userId} = ${centralSchema.users.id}
          AND ${centralSchema.familyMembers.isActive} = 1
      )`,
      ownedFamilyCount: sql<number>`(
        SELECT COUNT(*) FROM ${centralSchema.familyRegistry}
        WHERE ${centralSchema.familyRegistry.ownerId} = ${centralSchema.users.id}
      )`,
    })
    .from(centralSchema.users)
    .where(whereClause ?? sql`1=1`)
    .orderBy(desc(centralSchema.users.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return {
    rows: rows.map((r: typeof rows[number]) => ({
      ...r,
      isPlatformAdmin: r.isPlatformAdmin === 1,
      emailVerified: r.emailVerified === 1,
      familyCount: Number(r.familyCount),
      ownedFamilyCount: Number(r.ownedFamilyCount),
    })),
    total: totalRow?.n ?? 0,
  };
}

export interface UserDetail {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    isPlatformAdmin: boolean;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
  memberships: Array<{
    familyId: string;
    familyName: string;
    role: string;
    joinedAt: string;
    lastSeenAt: string | null;
    isActive: boolean;
  }>;
}

export async function getUserDetail(
  centralDb: CentralDb,
  userId: string,
): Promise<UserDetail | null> {
  const u = await centralDb
    .select()
    .from(centralSchema.users)
    .where(eq(centralSchema.users.id, userId))
    .get();
  if (!u) return null;

  const memberships = await centralDb
    .select({
      familyId: centralSchema.familyMembers.familyId,
      familyName: centralSchema.familyRegistry.name,
      role: centralSchema.familyMembers.role,
      joinedAt: centralSchema.familyMembers.joinedAt,
      lastSeenAt: centralSchema.familyMembers.lastSeenAt,
      isActive: centralSchema.familyMembers.isActive,
    })
    .from(centralSchema.familyMembers)
    .innerJoin(
      centralSchema.familyRegistry,
      eq(centralSchema.familyMembers.familyId, centralSchema.familyRegistry.id),
    )
    .where(eq(centralSchema.familyMembers.userId, userId))
    .orderBy(desc(centralSchema.familyMembers.joinedAt))
    .all();

  return {
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      isPlatformAdmin: u.isPlatformAdmin === 1,
      emailVerified: u.emailVerified === 1,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    },
    memberships: memberships.map((m: typeof memberships[number]) => ({
      ...m,
      isActive: m.isActive === 1,
    })),
  };
}

// ====================================================================
// Family listing & detail
// ====================================================================

export interface FamilyListRow {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  memberCount: number;
  pendingInviteCount: number;
  createdAt: string;
}

export async function listAllFamilies(
  centralDb: CentralDb,
  opts: ListAllUsersOpts = {},
): Promise<{ rows: FamilyListRow[]; total: number }> {
  const { q, offset = 0, limit = 50 } = opts;
  const search = q?.trim();

  const whereClause = search
    ? like(centralSchema.familyRegistry.name, `%${search}%`)
    : undefined;

  const totalRow = await centralDb
    .select({ n: count() })
    .from(centralSchema.familyRegistry)
    .where(whereClause ?? sql`1=1`)
    .get();

  const rows = await centralDb
    .select({
      id: centralSchema.familyRegistry.id,
      name: centralSchema.familyRegistry.name,
      ownerId: centralSchema.familyRegistry.ownerId,
      ownerName: centralSchema.users.name,
      ownerEmail: centralSchema.users.email,
      createdAt: centralSchema.familyRegistry.createdAt,
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM ${centralSchema.familyMembers}
        WHERE ${centralSchema.familyMembers.familyId} = ${centralSchema.familyRegistry.id}
          AND ${centralSchema.familyMembers.isActive} = 1
      )`,
      pendingInviteCount: sql<number>`(
        SELECT COUNT(*) FROM ${centralSchema.invitations}
        WHERE ${centralSchema.invitations.familyId} = ${centralSchema.familyRegistry.id}
          AND ${centralSchema.invitations.acceptedAt} IS NULL
          AND ${centralSchema.invitations.revokedAt} IS NULL
      )`,
    })
    .from(centralSchema.familyRegistry)
    .innerJoin(
      centralSchema.users,
      eq(centralSchema.users.id, centralSchema.familyRegistry.ownerId),
    )
    .where(whereClause ?? sql`1=1`)
    .orderBy(desc(centralSchema.familyRegistry.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return {
    rows: rows.map((r: typeof rows[number]) => ({
      ...r,
      memberCount: Number(r.memberCount),
      pendingInviteCount: Number(r.pendingInviteCount),
    })),
    total: totalRow?.n ?? 0,
  };
}

export interface FamilyDetail {
  family: {
    id: string;
    name: string;
    ownerId: string;
    dbFilename: string;
    moderationEnabled: boolean;
    maxMembers: number;
    monthlyAiBudgetUsd: number;
    createdAt: string;
    updatedAt: string;
  };
  members: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    avatarUrl: string | null;
    role: string;
    joinedAt: string;
    lastSeenAt: string | null;
    isActive: boolean;
  }>;
  invitations: {
    pending: number;
    total: number;
  };
}

export async function getFamilyDetail(
  centralDb: CentralDb,
  familyId: string,
): Promise<FamilyDetail | null> {
  const f = await centralDb
    .select()
    .from(centralSchema.familyRegistry)
    .where(eq(centralSchema.familyRegistry.id, familyId))
    .get();
  if (!f) return null;

  const members = await centralDb
    .select({
      userId: centralSchema.familyMembers.userId,
      userName: centralSchema.users.name,
      userEmail: centralSchema.users.email,
      avatarUrl: centralSchema.users.avatarUrl,
      role: centralSchema.familyMembers.role,
      joinedAt: centralSchema.familyMembers.joinedAt,
      lastSeenAt: centralSchema.familyMembers.lastSeenAt,
      isActive: centralSchema.familyMembers.isActive,
    })
    .from(centralSchema.familyMembers)
    .innerJoin(
      centralSchema.users,
      eq(centralSchema.users.id, centralSchema.familyMembers.userId),
    )
    .where(eq(centralSchema.familyMembers.familyId, familyId))
    .orderBy(desc(centralSchema.familyMembers.joinedAt))
    .all();

  const inviteCounts = await centralDb
    .select({
      pending: sql<number>`SUM(CASE WHEN ${centralSchema.invitations.acceptedAt} IS NULL AND ${centralSchema.invitations.revokedAt} IS NULL THEN 1 ELSE 0 END)`,
      total: count(),
    })
    .from(centralSchema.invitations)
    .where(eq(centralSchema.invitations.familyId, familyId))
    .get();

  return {
    family: {
      id: f.id,
      name: f.name,
      ownerId: f.ownerId,
      dbFilename: f.dbFilename,
      moderationEnabled: f.moderationEnabled === 1,
      maxMembers: f.maxMembers,
      monthlyAiBudgetUsd: f.monthlyAiBudgetUsd,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    },
    members: members.map((m: typeof members[number]) => ({
      ...m,
      isActive: m.isActive === 1,
    })),
    invitations: {
      pending: Number(inviteCounts?.pending ?? 0),
      total: inviteCounts?.total ?? 0,
    },
  };
}

// ====================================================================
// Dashboard counts
// ====================================================================

export interface PlatformCounts {
  userCount: number;
  familyCount: number;
  activeMembershipCount: number;
  signupsLast7d: number;
  platformAdminCount: number;
  pendingInvitesTotal: number;
}

/**
 * Caller passes `now` so this function stays pure — Next.js 16 cacheComponents
 * flags `Date.now()` inside server components unless request data was touched
 * first. Keeping the clock at the call site lets each page decide its own
 * dynamic-vs-cached boundary.
 */
export async function getPlatformCounts(
  centralDb: CentralDb,
  now: Date,
): Promise<PlatformCounts> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const nowIso = now.toISOString();

  const [users, families, memberships, recent, admins, pendingInvites] = await Promise.all([
    centralDb.select({ n: count() }).from(centralSchema.users).get(),
    centralDb.select({ n: count() }).from(centralSchema.familyRegistry).get(),
    centralDb
      .select({ n: count() })
      .from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.isActive, 1))
      .get(),
    centralDb
      .select({ n: count() })
      .from(centralSchema.users)
      .where(gte(centralSchema.users.createdAt, sevenDaysAgo))
      .get(),
    centralDb
      .select({ n: count() })
      .from(centralSchema.users)
      .where(eq(centralSchema.users.isPlatformAdmin, 1))
      .get(),
    centralDb
      .select({ n: count() })
      .from(centralSchema.invitations)
      .where(
        and(
          isNull(centralSchema.invitations.acceptedAt),
          isNull(centralSchema.invitations.revokedAt),
          gt(centralSchema.invitations.expiresAt, nowIso),
        ),
      )
      .get(),
  ]);

  return {
    userCount: users?.n ?? 0,
    familyCount: families?.n ?? 0,
    activeMembershipCount: memberships?.n ?? 0,
    signupsLast7d: recent?.n ?? 0,
    platformAdminCount: admins?.n ?? 0,
    pendingInvitesTotal: pendingInvites?.n ?? 0,
  };
}

// ====================================================================
// Audit log
// ====================================================================

export interface LogPlatformActivityOpts {
  actorUserId: string;
  action: string;                 // e.g. 'platform_admin.toggle'
  targetType: 'user' | 'family';
  targetId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function logPlatformActivity(
  centralDb: CentralDb,
  opts: LogPlatformActivityOpts,
): Promise<void> {
  await centralDb
    .insert(centralSchema.platformAuditLog)
    .values({
      actorUserId: opts.actorUserId,
      action: opts.action,
      targetType: opts.targetType,
      targetId: opts.targetId,
      summary: opts.summary,
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
    })
    .run();
}

// --------------------------------------------------------------------
// Audit log query (read API for /admin/audit)
// --------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorName: string;
  actorEmail: string;
  actorAvatarUrl: string | null;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListAuditLogOpts {
  cursor?: string; // opaque: the row id to seek past
  limit?: number;
  actorUserId?: string;
  targetType?: 'user' | 'family';
  targetId?: string;
  action?: string;
  since?: string; // ISO 8601 inclusive lower bound on createdAt
  until?: string; // ISO 8601 inclusive upper bound on createdAt
}

export interface ListAuditLogResult {
  items: AuditLogEntry[];
  nextCursor: string | null;
}

/**
 * Cursor-paginated platform audit log query. Mirrors getActivityFeed's
 * composite-cursor pattern: cursor is the trailing row's id, looked up
 * to recover its createdAt for a stable (createdAt DESC, id DESC) seek.
 *
 * Joins users to enrich actor display fields. Parses metadata JSON.
 */
export async function listAuditLog(
  centralDb: CentralDb,
  opts: ListAuditLogOpts = {},
): Promise<ListAuditLogResult> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const conditions = [] as ReturnType<typeof eq>[];

  if (opts.actorUserId) {
    conditions.push(eq(centralSchema.platformAuditLog.actorUserId, opts.actorUserId));
  }
  if (opts.targetType) {
    conditions.push(eq(centralSchema.platformAuditLog.targetType, opts.targetType));
  }
  if (opts.targetId) {
    conditions.push(eq(centralSchema.platformAuditLog.targetId, opts.targetId));
  }
  if (opts.action) {
    conditions.push(eq(centralSchema.platformAuditLog.action, opts.action));
  }
  if (opts.since) {
    conditions.push(gte(centralSchema.platformAuditLog.createdAt, opts.since));
  }
  if (opts.until) {
    conditions.push(lte(centralSchema.platformAuditLog.createdAt, opts.until));
  }

  if (opts.cursor) {
    const cursorRow = await centralDb
      .select({
        createdAt: centralSchema.platformAuditLog.createdAt,
        id: centralSchema.platformAuditLog.id,
      })
      .from(centralSchema.platformAuditLog)
      .where(eq(centralSchema.platformAuditLog.id, opts.cursor))
      .get();

    if (cursorRow) {
      conditions.push(
        or(
          lt(centralSchema.platformAuditLog.createdAt, cursorRow.createdAt),
          and(
            eq(centralSchema.platformAuditLog.createdAt, cursorRow.createdAt),
            lt(centralSchema.platformAuditLog.id, cursorRow.id),
          ),
        )!,
      );
    }
  }

  const rows = await centralDb
    .select({
      id: centralSchema.platformAuditLog.id,
      actorUserId: centralSchema.platformAuditLog.actorUserId,
      actorName: centralSchema.users.name,
      actorEmail: centralSchema.users.email,
      actorAvatarUrl: centralSchema.users.avatarUrl,
      action: centralSchema.platformAuditLog.action,
      targetType: centralSchema.platformAuditLog.targetType,
      targetId: centralSchema.platformAuditLog.targetId,
      summary: centralSchema.platformAuditLog.summary,
      metadata: centralSchema.platformAuditLog.metadata,
      createdAt: centralSchema.platformAuditLog.createdAt,
    })
    .from(centralSchema.platformAuditLog)
    .innerJoin(
      centralSchema.users,
      eq(centralSchema.users.id, centralSchema.platformAuditLog.actorUserId),
    )
    .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
    .orderBy(
      desc(centralSchema.platformAuditLog.createdAt),
      desc(centralSchema.platformAuditLog.id),
    )
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const items: AuditLogEntry[] = rows.slice(0, limit).map((r: typeof rows[number]) => ({
    id: r.id,
    actorUserId: r.actorUserId,
    actorName: r.actorName,
    actorEmail: r.actorEmail,
    actorAvatarUrl: r.actorAvatarUrl,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    summary: r.summary,
    metadata: r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null,
    createdAt: r.createdAt,
  }));

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

/**
 * Distinct action names actually present in the audit log. Used to populate
 * the action filter dropdown on /admin/audit so it stays in sync with what
 * has actually been logged (no stale UI keys from removed action types).
 */
export async function listAuditLogActions(centralDb: CentralDb): Promise<string[]> {
  const rows = await centralDb
    .selectDistinct({ action: centralSchema.platformAuditLog.action })
    .from(centralSchema.platformAuditLog)
    .orderBy(centralSchema.platformAuditLog.action)
    .all();
  return rows.map((r: { action: string }) => r.action);
}

/**
 * Helper for self-demotion guard: returns count of OTHER platform admins
 * (excluding the given userId).
 */
export async function countOtherPlatformAdmins(
  centralDb: CentralDb,
  excludingUserId: string,
): Promise<number> {
  const row = await centralDb
    .select({ n: count() })
    .from(centralSchema.users)
    .where(
      and(
        eq(centralSchema.users.isPlatformAdmin, 1),
        sql`${centralSchema.users.id} != ${excludingUserId}`,
      ),
    )
    .get();
  return row?.n ?? 0;
}
