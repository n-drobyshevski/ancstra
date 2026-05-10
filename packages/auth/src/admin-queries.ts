import { eq, ne, and, or, like, sql, count, isNull, desc, gte, gt, lt, lte, inArray } from 'drizzle-orm';
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
  /** Up to first {@link TOOLTIP_NAME_LIMIT} family names where user is an active member, newest joinedAt first. */
  familyNames: string[];
  /** Up to first {@link TOOLTIP_NAME_LIMIT} family names this user owns, newest createdAt first. */
  ownedFamilyNames: string[];
  createdAt: string;
  /** ISO 8601 if soft-deleted; null if active. Surfaced for the Restore UI. */
  deletedAt: string | null;
}

/** How many names we surface in admin-table hover tooltips before collapsing the rest into "and N more". */
const TOOLTIP_NAME_LIMIT = 10;

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

  // Always exclude soft-deleted users from admin listings.
  const notDeleted = isNull(centralSchema.users.deletedAt);
  const whereClause = search
    ? and(
        notDeleted,
        or(
          like(centralSchema.users.email, `%${search}%`),
          like(centralSchema.users.name, `%${search}%`),
        ),
      )
    : notDeleted;

  const totalRow = await centralDb
    .select({ n: count() })
    .from(centralSchema.users)
    .where(whereClause)
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
      deletedAt: centralSchema.users.deletedAt,
      // NOTE: outer table column is referenced as a raw identifier
      // (`users.id`) instead of `${centralSchema.users.id}`. Drizzle's `sql`
      // tag interpolates Column refs as bare unqualified names, so inside a
      // correlated subquery `WHERE "user_id" = "id"` resolves to the inner
      // table's own `id` and the count silently returns 0 for every row.
      //
      // The inner subquery joins `family_registry` so we can filter out
      // soft-deleted families. Both joined tables expose `id` and
      // `deleted_at`, so we hand-qualify every column with its table name —
      // the `${col}` interpolation would emit ambiguous bare names.
      familyCount: sql<number>`(
        SELECT COUNT(*) FROM family_members
        INNER JOIN family_registry
          ON family_registry.id = family_members.family_id
        WHERE family_members.user_id = users.id
          AND family_members.is_active = 1
          AND family_registry.deleted_at IS NULL
      )`,
      ownedFamilyCount: sql<number>`(
        SELECT COUNT(*) FROM family_registry
        WHERE family_registry.owner_id = users.id
          AND family_registry.deleted_at IS NULL
      )`,
    })
    .from(centralSchema.users)
    .where(whereClause)
    .orderBy(desc(centralSchema.users.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  // Secondary fetch for hover-tooltip content. We can't reliably take a
  // per-user LIMIT inside the main correlated subqueries, so pull names for
  // just this page's user IDs and slice in JS — bounded by PAGE_SIZE *
  // (avg memberships + avg owned families), well under any practical row cap.
  const userIds = rows.map((r: typeof rows[number]) => r.id as string);
  const familyNamesByUser = new Map<string, string[]>();
  const ownedNamesByUser = new Map<string, string[]>();

  if (userIds.length > 0) {
    const memberships = await centralDb
      .select({
        userId: centralSchema.familyMembers.userId,
        familyName: centralSchema.familyRegistry.name,
      })
      .from(centralSchema.familyMembers)
      .innerJoin(
        centralSchema.familyRegistry,
        eq(centralSchema.familyRegistry.id, centralSchema.familyMembers.familyId),
      )
      .where(
        and(
          inArray(centralSchema.familyMembers.userId, userIds),
          eq(centralSchema.familyMembers.isActive, 1),
          isNull(centralSchema.familyRegistry.deletedAt),
        ),
      )
      .orderBy(
        centralSchema.familyMembers.userId,
        desc(centralSchema.familyMembers.joinedAt),
      )
      .all();

    for (const m of memberships as Array<{ userId: string; familyName: string }>) {
      const arr = familyNamesByUser.get(m.userId) ?? [];
      if (arr.length < TOOLTIP_NAME_LIMIT) arr.push(m.familyName);
      familyNamesByUser.set(m.userId, arr);
    }

    const owned = await centralDb
      .select({
        ownerId: centralSchema.familyRegistry.ownerId,
        familyName: centralSchema.familyRegistry.name,
      })
      .from(centralSchema.familyRegistry)
      .where(
        and(
          inArray(centralSchema.familyRegistry.ownerId, userIds),
          isNull(centralSchema.familyRegistry.deletedAt),
        ),
      )
      .orderBy(
        centralSchema.familyRegistry.ownerId,
        desc(centralSchema.familyRegistry.createdAt),
      )
      .all();

    for (const o of owned as Array<{ ownerId: string; familyName: string }>) {
      const arr = ownedNamesByUser.get(o.ownerId) ?? [];
      if (arr.length < TOOLTIP_NAME_LIMIT) arr.push(o.familyName);
      ownedNamesByUser.set(o.ownerId, arr);
    }
  }

  return {
    rows: rows.map((r: typeof rows[number]) => ({
      ...r,
      isPlatformAdmin: r.isPlatformAdmin === 1,
      emailVerified: r.emailVerified === 1,
      familyCount: Number(r.familyCount),
      ownedFamilyCount: Number(r.ownedFamilyCount),
      familyNames: familyNamesByUser.get(r.id) ?? [],
      ownedFamilyNames: ownedNamesByUser.get(r.id) ?? [],
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
    .where(
      and(
        eq(centralSchema.users.id, userId),
        isNull(centralSchema.users.deletedAt),
      ),
    )
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
  /** Up to first {@link TOOLTIP_NAME_LIMIT} active member display names, newest joinedAt first. */
  memberNames: string[];
  createdAt: string;
  /** ISO 8601 if soft-deleted; null if active. Surfaced for the Restore UI. */
  deletedAt: string | null;
}

export async function listAllFamilies(
  centralDb: CentralDb,
  opts: ListAllUsersOpts = {},
): Promise<{ rows: FamilyListRow[]; total: number }> {
  const { q, offset = 0, limit = 50 } = opts;
  const search = q?.trim();

  const notDeleted = isNull(centralSchema.familyRegistry.deletedAt);
  const whereClause = search
    ? and(notDeleted, like(centralSchema.familyRegistry.name, `%${search}%`))
    : notDeleted;

  const totalRow = await centralDb
    .select({ n: count() })
    .from(centralSchema.familyRegistry)
    .where(whereClause)
    .get();

  const rows = await centralDb
    .select({
      id: centralSchema.familyRegistry.id,
      name: centralSchema.familyRegistry.name,
      ownerId: centralSchema.familyRegistry.ownerId,
      ownerName: centralSchema.users.name,
      ownerEmail: centralSchema.users.email,
      createdAt: centralSchema.familyRegistry.createdAt,
      deletedAt: centralSchema.familyRegistry.deletedAt,
      // See note in listAllUsers: outer table column referenced as raw
      // identifier so the correlated subquery resolves it correctly.
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM ${centralSchema.familyMembers}
        WHERE ${centralSchema.familyMembers.familyId} = family_registry.id
          AND ${centralSchema.familyMembers.isActive} = 1
      )`,
      pendingInviteCount: sql<number>`(
        SELECT COUNT(*) FROM ${centralSchema.invitations}
        WHERE ${centralSchema.invitations.familyId} = family_registry.id
          AND ${centralSchema.invitations.acceptedAt} IS NULL
          AND ${centralSchema.invitations.revokedAt} IS NULL
      )`,
    })
    .from(centralSchema.familyRegistry)
    .innerJoin(
      centralSchema.users,
      eq(centralSchema.users.id, centralSchema.familyRegistry.ownerId),
    )
    .where(whereClause)
    .orderBy(desc(centralSchema.familyRegistry.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const familyIds = rows.map((r: typeof rows[number]) => r.id as string);
  const memberNamesByFamily = new Map<string, string[]>();

  if (familyIds.length > 0) {
    const members = await centralDb
      .select({
        familyId: centralSchema.familyMembers.familyId,
        userName: centralSchema.users.name,
      })
      .from(centralSchema.familyMembers)
      .innerJoin(
        centralSchema.users,
        eq(centralSchema.users.id, centralSchema.familyMembers.userId),
      )
      .where(
        and(
          inArray(centralSchema.familyMembers.familyId, familyIds),
          eq(centralSchema.familyMembers.isActive, 1),
        ),
      )
      .orderBy(
        centralSchema.familyMembers.familyId,
        desc(centralSchema.familyMembers.joinedAt),
      )
      .all();

    for (const m of members as Array<{ familyId: string; userName: string }>) {
      const arr = memberNamesByFamily.get(m.familyId) ?? [];
      if (arr.length < TOOLTIP_NAME_LIMIT) arr.push(m.userName);
      memberNamesByFamily.set(m.familyId, arr);
    }
  }

  return {
    rows: rows.map((r: typeof rows[number]) => ({
      ...r,
      memberCount: Number(r.memberCount),
      pendingInviteCount: Number(r.pendingInviteCount),
      memberNames: memberNamesByFamily.get(r.id) ?? [],
    })),
    total: totalRow?.n ?? 0,
  };
}

// ====================================================================
// Existence checks (uncached — used to gate cached detail readers so
// transient nulls / not-found cases never get baked into the cache)
// ====================================================================

export async function familyExists(
  centralDb: CentralDb,
  familyId: string,
): Promise<boolean> {
  const row = await centralDb
    .select({ id: centralSchema.familyRegistry.id })
    .from(centralSchema.familyRegistry)
    .where(
      and(
        eq(centralSchema.familyRegistry.id, familyId),
        isNull(centralSchema.familyRegistry.deletedAt),
      ),
    )
    .get();
  return !!row;
}

export async function userExists(
  centralDb: CentralDb,
  userId: string,
): Promise<boolean> {
  const row = await centralDb
    .select({ id: centralSchema.users.id })
    .from(centralSchema.users)
    .where(
      and(
        eq(centralSchema.users.id, userId),
        isNull(centralSchema.users.deletedAt),
      ),
    )
    .get();
  return !!row;
}

// ====================================================================
// Family search (for admin pickers — cross-family member ops)
// ====================================================================

export interface SearchFamilyResult {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  memberCount: number;
  maxMembers: number;
}

/**
 * Lightweight family search for autocomplete pickers (e.g. cross-family
 * member add/move dialogs). Distinct from `listAllFamilies` which is the
 * paginated admin index — this one returns just enough to display a
 * picker row and warn about member-cap overflow.
 */
export async function searchFamilies(
  centralDb: CentralDb,
  opts: { q?: string; excludeFamilyId?: string; limit?: number } = {},
): Promise<SearchFamilyResult[]> {
  const { q, excludeFamilyId, limit = 10 } = opts;
  const search = q?.trim();

  const conditions: ReturnType<typeof eq>[] = [
    isNull(centralSchema.familyRegistry.deletedAt),
  ];
  if (search) {
    conditions.push(like(centralSchema.familyRegistry.name, `%${search}%`));
  }
  if (excludeFamilyId) {
    conditions.push(ne(centralSchema.familyRegistry.id, excludeFamilyId));
  }

  const rows = await centralDb
    .select({
      id: centralSchema.familyRegistry.id,
      name: centralSchema.familyRegistry.name,
      ownerId: centralSchema.familyRegistry.ownerId,
      ownerEmail: centralSchema.users.email,
      maxMembers: centralSchema.familyRegistry.maxMembers,
      // See note in listAllUsers: outer table column referenced as raw
      // identifier so the correlated subquery resolves it correctly.
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM ${centralSchema.familyMembers}
        WHERE ${centralSchema.familyMembers.familyId} = family_registry.id
          AND ${centralSchema.familyMembers.isActive} = 1
      )`,
    })
    .from(centralSchema.familyRegistry)
    .innerJoin(
      centralSchema.users,
      eq(centralSchema.users.id, centralSchema.familyRegistry.ownerId),
    )
    .where(and(...conditions))
    .orderBy(centralSchema.familyRegistry.name)
    .limit(limit)
    .all();

  return rows.map((r: typeof rows[number]) => ({
    ...r,
    memberCount: Number(r.memberCount),
  }));
}

// ====================================================================
// User search (for admin owner-picker — /admin/families AddFamilyDialog)
// ====================================================================

export interface UserSearchRow {
  id: string;
  name: string;
  email: string;
  ownedFamiliesCount: number;
}

/**
 * Lightweight user search for the owner picker on /admin/families.
 * Symmetrical with searchFamilies. Filters by name OR email substring,
 * orders alphabetically by name, and reports how many families each user
 * already owns (informational — surfaced as "owns N families" subtext on
 * each picker row so a platform admin can see ownership context).
 */
export async function searchUsers(
  centralDb: CentralDb,
  opts: { q?: string; excludeUserId?: string; limit?: number } = {},
): Promise<UserSearchRow[]> {
  const { q, excludeUserId, limit = 10 } = opts;
  const search = q?.trim();

  const conditions: ReturnType<typeof eq>[] = [
    isNull(centralSchema.users.deletedAt),
  ];
  if (search) {
    conditions.push(
      or(
        like(centralSchema.users.name, `%${search}%`),
        like(centralSchema.users.email, `%${search}%`),
      )!,
    );
  }
  if (excludeUserId) {
    conditions.push(ne(centralSchema.users.id, excludeUserId));
  }

  const rows = await centralDb
    .select({
      id: centralSchema.users.id,
      name: centralSchema.users.name,
      email: centralSchema.users.email,
      // Outer table column referenced as raw identifier so the correlated
      // subquery resolves it correctly — same pattern as searchFamilies.
      ownedFamiliesCount: sql<number>`(
        SELECT COUNT(*) FROM ${centralSchema.familyRegistry}
        WHERE ${centralSchema.familyRegistry.ownerId} = users.id
          AND ${centralSchema.familyRegistry.deletedAt} IS NULL
      )`,
    })
    .from(centralSchema.users)
    .where(and(...conditions))
    .orderBy(centralSchema.users.name)
    .limit(limit)
    .all();

  return rows.map((r: typeof rows[number]) => ({
    ...r,
    ownedFamiliesCount: Number(r.ownedFamiliesCount),
  }));
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
    .where(
      and(
        eq(centralSchema.familyRegistry.id, familyId),
        isNull(centralSchema.familyRegistry.deletedAt),
      ),
    )
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
    centralDb
      .select({ n: count() })
      .from(centralSchema.users)
      .where(isNull(centralSchema.users.deletedAt))
      .get(),
    centralDb
      .select({ n: count() })
      .from(centralSchema.familyRegistry)
      .where(isNull(centralSchema.familyRegistry.deletedAt))
      .get(),
    centralDb
      .select({ n: count() })
      .from(centralSchema.familyMembers)
      .where(eq(centralSchema.familyMembers.isActive, 1))
      .get(),
    centralDb
      .select({ n: count() })
      .from(centralSchema.users)
      .where(
        and(
          isNull(centralSchema.users.deletedAt),
          gte(centralSchema.users.createdAt, sevenDaysAgo),
        ),
      )
      .get(),
    centralDb
      .select({ n: count() })
      .from(centralSchema.users)
      .where(
        and(
          eq(centralSchema.users.isPlatformAdmin, 1),
          isNull(centralSchema.users.deletedAt),
        ),
      )
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
  // 'platform' is for actions on the singleton platform_settings row (no
  // specific user or family target). The DB column is plain TEXT — the union
  // is purely an application-layer contract for callers.
  targetType: 'user' | 'family' | 'platform';
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
  targetType?: 'user' | 'family' | 'platform';
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
        isNull(centralSchema.users.deletedAt),
        sql`${centralSchema.users.id} != ${excludingUserId}`,
      ),
    )
    .get();
  return row?.n ?? 0;
}

// ====================================================================
// Soft-delete helpers (platform-admin destructive actions)
// ====================================================================

export interface SoftDeleteFamilyResult {
  deleted: boolean;
  dbFilename: string;
  memberCount: number;
}

/**
 * Soft-delete a family: stamp `deletedAt`, bump every active member's
 * `membershipsVersion` so their JWTs re-derive on the next request and lose
 * the family from claims. The per-family DB (`dbFilename`) is left intact;
 * the caller records it in audit metadata for any future purge job.
 */
export async function softDeleteFamily(
  centralDb: CentralDb,
  familyId: string,
): Promise<SoftDeleteFamilyResult> {
  const family = await centralDb
    .select({
      id: centralSchema.familyRegistry.id,
      dbFilename: centralSchema.familyRegistry.dbFilename,
      deletedAt: centralSchema.familyRegistry.deletedAt,
    })
    .from(centralSchema.familyRegistry)
    .where(eq(centralSchema.familyRegistry.id, familyId))
    .get();
  if (!family) throw new Error(`Family ${familyId} not found`);
  if (family.deletedAt) throw new Error(`Family ${familyId} is already soft-deleted`);

  const memberRows = await centralDb
    .select({ userId: centralSchema.familyMembers.userId })
    .from(centralSchema.familyMembers)
    .where(
      and(
        eq(centralSchema.familyMembers.familyId, familyId),
        eq(centralSchema.familyMembers.isActive, 1),
      ),
    )
    .all();
  const userIds = memberRows.map((r: { userId: string }) => r.userId);

  const now = new Date().toISOString();

  await centralDb
    .update(centralSchema.familyRegistry)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(centralSchema.familyRegistry.id, familyId))
    .run();

  if (userIds.length > 0) {
    await centralDb
      .update(centralSchema.users)
      .set({
        membershipsVersion: sql`${centralSchema.users.membershipsVersion} + 1`,
        updatedAt: now,
      })
      .where(inArray(centralSchema.users.id, userIds))
      .run();
  }

  return { deleted: true, dbFilename: family.dbFilename, memberCount: userIds.length };
}

export interface SoftDeleteUserResult {
  deleted: boolean;
  removedFromFamilies: number;
}

/**
 * Soft-delete a user: stamp `deletedAt`, deactivate every active membership
 * (so the user vanishes from family rosters and member counts).
 *
 * Owned families are NOT touched here; the calling tRPC mutation enforces a
 * "force-transfer ownership first" precondition so deletion never strands a
 * family without an owner.
 */
export async function softDeleteUser(
  centralDb: CentralDb,
  userId: string,
): Promise<SoftDeleteUserResult> {
  const user = await centralDb
    .select({
      id: centralSchema.users.id,
      deletedAt: centralSchema.users.deletedAt,
    })
    .from(centralSchema.users)
    .where(eq(centralSchema.users.id, userId))
    .get();
  if (!user) throw new Error(`User ${userId} not found`);
  if (user.deletedAt) throw new Error(`User ${userId} is already soft-deleted`);

  const memberships = await centralDb
    .select({ familyId: centralSchema.familyMembers.familyId })
    .from(centralSchema.familyMembers)
    .where(
      and(
        eq(centralSchema.familyMembers.userId, userId),
        eq(centralSchema.familyMembers.isActive, 1),
      ),
    )
    .all();
  const familyIds = memberships.map((m: { familyId: string }) => m.familyId);

  const now = new Date().toISOString();

  await centralDb
    .update(centralSchema.users)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(centralSchema.users.id, userId))
    .run();

  if (familyIds.length > 0) {
    await centralDb
      .update(centralSchema.familyMembers)
      .set({ isActive: 0 })
      .where(
        and(
          eq(centralSchema.familyMembers.userId, userId),
          eq(centralSchema.familyMembers.isActive, 1),
        ),
      )
      .run();
  }

  return { deleted: true, removedFromFamilies: familyIds.length };
}

/**
 * Returns owned non-deleted families for a user. Used by the deleteUser
 * safeguard to block deletion if the user still owns active families —
 * they must force-transfer ownership first.
 */
export async function listOwnedActiveFamilies(
  centralDb: CentralDb,
  userId: string,
): Promise<Array<{ id: string; name: string }>> {
  return await centralDb
    .select({
      id: centralSchema.familyRegistry.id,
      name: centralSchema.familyRegistry.name,
    })
    .from(centralSchema.familyRegistry)
    .where(
      and(
        eq(centralSchema.familyRegistry.ownerId, userId),
        isNull(centralSchema.familyRegistry.deletedAt),
      ),
    )
    .all();
}
