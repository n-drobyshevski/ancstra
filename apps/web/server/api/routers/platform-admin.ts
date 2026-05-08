import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq, and, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { updateTag } from 'next/cache';
import { centralSchema } from '@ancstra/db';
import {
  bumpMembershipsVersion,
  updateFamilySettings,
  transferOwnership,
  ConcurrentTransferError,
  logActivity,
  listFamilyInvitations,
  revokeInvite,
  createFamily as createFamilyHelper,
} from '@ancstra/auth';
import {
  countOtherPlatformAdmins,
  listAuditLog,
  listAuditLogActions,
  logPlatformActivity,
  searchFamilies,
  searchUsers,
} from '@ancstra/auth/admin';
import { createTRPCRouter, platformAdminProcedure } from '../trpc';

const SETTINGS_FIELD_LABELS: Record<string, string> = {
  name: 'name',
  maxMembers: 'member limit',
  monthlyAiBudgetUsd: 'AI budget',
  moderationEnabled: 'moderation',
};

export const platformAdminRouter = createTRPCRouter({
  listAuditLog: platformAdminProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(200).optional(),
        actorUserId: z.string().optional(),
        targetType: z.enum(['user', 'family']).optional(),
        targetId: z.string().optional(),
        action: z.string().optional(),
        since: z.string().datetime().optional(),
        until: z.string().datetime().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listAuditLog(ctx.centralDb, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        actorUserId: input.actorUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        action: input.action,
        since: input.since,
        until: input.until,
      });
    }),

  listAuditLogActions: platformAdminProcedure.query(async ({ ctx }) => {
    return listAuditLogActions(ctx.centralDb);
  }),

  updateFamilySettings: platformAdminProcedure
    .input(
      z.object({
        familyId: z.string().min(1),
        name: z.string().trim().min(1, 'Family name is required').optional(),
        maxMembers: z.number().int().min(1).max(10000).optional(),
        monthlyAiBudgetUsd: z.number().min(0).max(100000).optional(),
        moderationEnabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.centralDb
        .select()
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, input.familyId))
        .get();
      if (!before) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Family not found' });
      }

      const { row, changed } = await updateFamilySettings(
        ctx.centralDb,
        input.familyId,
        {
          name: input.name,
          maxMembers: input.maxMembers,
          monthlyAiBudgetUsd: input.monthlyAiBudgetUsd,
          moderationEnabled: input.moderationEnabled,
        },
      );

      if (changed.length > 0) {
        const labels = changed.map((k) => SETTINGS_FIELD_LABELS[k] ?? k);
        const summary =
          labels.length === 1
            ? `Updated ${before.name}: ${labels[0]}`
            : `Updated ${before.name}: ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

        const beforeValues: Record<string, unknown> = {};
        const afterValues: Record<string, unknown> = {};
        const beforeRecord = before as unknown as Record<string, unknown>;
        const afterRecord = row as unknown as Record<string, unknown>;
        for (const key of changed) {
          if (key === 'moderationEnabled') {
            beforeValues[key] = before.moderationEnabled === 1;
            afterValues[key] = row.moderationEnabled;
          } else {
            beforeValues[key] = beforeRecord[key];
            afterValues[key] = afterRecord[key];
          }
        }

        await logPlatformActivity(ctx.centralDb, {
          actorUserId: ctx.platformAdmin.userId,
          action: 'family.settings.update',
          targetType: 'family',
          targetId: input.familyId,
          summary,
          metadata: {
            changed,
            before: beforeValues,
            after: afterValues,
          },
        });

        updateTag('platform-families');
        updateTag(`platform-family:${input.familyId}`);
        updateTag('platform-audit-log');
      }

      return { row, changed };
    }),

  // ----- Member management overrides -------------------------------------
  // These bypass the family-scope `members:manage` permission gate (platform
  // admin is not a member of the target family). They still log to BOTH
  // platform_audit_log (cross-family record of override) AND activity_feed
  // (family-scoped record so members can see what was done by whom).
  // -----------------------------------------------------------------------

  changeMemberRole: platformAdminProcedure
    .input(
      z.object({
        familyId: z.string().min(1),
        userId: z.string().min(1),
        role: z.enum(['admin', 'editor', 'viewer']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const family = await ctx.centralDb
        .select({
          name: centralSchema.familyRegistry.name,
        })
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, input.familyId))
        .get();
      if (!family) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Family not found' });
      }

      const member = await ctx.centralDb
        .select({
          id: centralSchema.familyMembers.id,
          role: centralSchema.familyMembers.role,
          isActive: centralSchema.familyMembers.isActive,
          userName: centralSchema.users.name,
          userEmail: centralSchema.users.email,
        })
        .from(centralSchema.familyMembers)
        .innerJoin(
          centralSchema.users,
          eq(centralSchema.users.id, centralSchema.familyMembers.userId),
        )
        .where(
          and(
            eq(centralSchema.familyMembers.familyId, input.familyId),
            eq(centralSchema.familyMembers.userId, input.userId),
            eq(centralSchema.familyMembers.isActive, 1),
          ),
        )
        .get();
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      // Owner role can only be changed via forceTransferOwnership (the partial
      // unique index enforces single-owner; demoting via plain update breaks
      // invariants).
      if (member.role === 'owner') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Use forceTransferOwnership to demote the current owner',
        });
      }
      if (member.role === input.role) {
        return { changed: false } as const;
      }

      const oldRole = member.role;

      await ctx.centralDb
        .update(centralSchema.familyMembers)
        .set({ role: input.role })
        .where(eq(centralSchema.familyMembers.id, member.id))
        .run();

      await bumpMembershipsVersion(ctx.centralDb, input.userId);

      const summary = `Platform admin changed ${member.userName}'s role from ${oldRole} to ${input.role} in ${family.name}`;
      await logPlatformActivity(ctx.centralDb, {
        actorUserId: ctx.platformAdmin.userId,
        action: 'family.member.role-change',
        targetType: 'family',
        targetId: input.familyId,
        summary,
        metadata: {
          targetUserId: input.userId,
          targetUserName: member.userName,
          oldRole,
          newRole: input.role,
        },
      });
      await logActivity(ctx.centralDb, {
        familyId: input.familyId,
        userId: ctx.platformAdmin.userId,
        action: 'role_changed',
        summary,
        metadata: { targetUserId: input.userId, oldRole, newRole: input.role, byPlatformAdmin: true },
      });

      updateTag(`platform-family:${input.familyId}`);
      updateTag('platform-users');
      updateTag(`platform-user:${input.userId}`);
      updateTag('platform-audit-log');
      return { changed: true } as const;
    }),

  removeMember: platformAdminProcedure
    .input(
      z.object({
        familyId: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const family = await ctx.centralDb
        .select({ name: centralSchema.familyRegistry.name })
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, input.familyId))
        .get();
      if (!family) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Family not found' });
      }

      const member = await ctx.centralDb
        .select({
          id: centralSchema.familyMembers.id,
          role: centralSchema.familyMembers.role,
          userName: centralSchema.users.name,
          userEmail: centralSchema.users.email,
        })
        .from(centralSchema.familyMembers)
        .innerJoin(
          centralSchema.users,
          eq(centralSchema.users.id, centralSchema.familyMembers.userId),
        )
        .where(
          and(
            eq(centralSchema.familyMembers.familyId, input.familyId),
            eq(centralSchema.familyMembers.userId, input.userId),
            eq(centralSchema.familyMembers.isActive, 1),
          ),
        )
        .get();
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }
      if (member.role === 'owner') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot remove the family owner. Force-transfer ownership first.',
        });
      }

      await ctx.centralDb
        .update(centralSchema.familyMembers)
        .set({ isActive: 0 })
        .where(eq(centralSchema.familyMembers.id, member.id))
        .run();

      await bumpMembershipsVersion(ctx.centralDb, input.userId);

      const summary = `Platform admin removed ${member.userName} (${member.role}) from ${family.name}`;
      await logPlatformActivity(ctx.centralDb, {
        actorUserId: ctx.platformAdmin.userId,
        action: 'family.member.remove',
        targetType: 'family',
        targetId: input.familyId,
        summary,
        metadata: {
          targetUserId: input.userId,
          targetUserName: member.userName,
          role: member.role,
        },
      });
      await logActivity(ctx.centralDb, {
        familyId: input.familyId,
        userId: ctx.platformAdmin.userId,
        action: 'member_removed',
        summary,
        metadata: { targetUserId: input.userId, role: member.role, byPlatformAdmin: true },
      });

      updateTag(`platform-family:${input.familyId}`);
      updateTag('platform-users');
      updateTag(`platform-user:${input.userId}`);
      updateTag('platform-audit-log');
      return { ok: true } as const;
    }),

  forceTransferOwnership: platformAdminProcedure
    .input(
      z.object({
        familyId: z.string().min(1),
        newOwnerUserId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const family = await ctx.centralDb
        .select({
          name: centralSchema.familyRegistry.name,
          ownerId: centralSchema.familyRegistry.ownerId,
        })
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, input.familyId))
        .get();
      if (!family) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Family not found' });
      }
      if (family.ownerId === input.newOwnerUserId) {
        return { changed: false } as const;
      }

      const previousOwnerId = family.ownerId;

      try {
        const result = await transferOwnership(ctx.centralDb, {
          familyId: input.familyId,
          currentOwnerId: previousOwnerId,
          newOwnerId: input.newOwnerUserId,
        });
        if (!result.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.error ?? 'Transfer failed',
          });
        }
      } catch (err) {
        if (err instanceof ConcurrentTransferError) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Concurrent transfer detected. Please retry.',
          });
        }
        throw err;
      }

      // Look up names for the audit row.
      const [previousOwner, newOwner] = await Promise.all([
        ctx.centralDb
          .select({ name: centralSchema.users.name })
          .from(centralSchema.users)
          .where(eq(centralSchema.users.id, previousOwnerId))
          .get(),
        ctx.centralDb
          .select({ name: centralSchema.users.name })
          .from(centralSchema.users)
          .where(eq(centralSchema.users.id, input.newOwnerUserId))
          .get(),
      ]);

      const summary = `Platform admin transferred ownership of ${family.name} from ${previousOwner?.name ?? previousOwnerId} to ${newOwner?.name ?? input.newOwnerUserId}`;

      await logPlatformActivity(ctx.centralDb, {
        actorUserId: ctx.platformAdmin.userId,
        action: 'family.ownership.force-transfer',
        targetType: 'family',
        targetId: input.familyId,
        summary,
        metadata: {
          previousOwnerId,
          newOwnerId: input.newOwnerUserId,
          previousOwnerName: previousOwner?.name,
          newOwnerName: newOwner?.name,
        },
      });
      await logActivity(ctx.centralDb, {
        familyId: input.familyId,
        userId: ctx.platformAdmin.userId,
        action: 'owner_transferred',
        summary,
        metadata: { previousOwnerId, newOwnerId: input.newOwnerUserId, byPlatformAdmin: true },
      });

      updateTag(`platform-family:${input.familyId}`);
      updateTag('platform-users');
      updateTag('platform-families');
      updateTag(`platform-user:${previousOwnerId}`);
      updateTag(`platform-user:${input.newOwnerUserId}`);
      updateTag('platform-audit-log');
      return { changed: true } as const;
    }),

  listInvitations: platformAdminProcedure
    .input(
      z.object({
        familyId: z.string().min(1),
        status: z.enum(['pending', 'all']).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Enrich with inviter name so the UI doesn't need a second round-trip.
      const rows = await listFamilyInvitations(ctx.centralDb, input.familyId, {
        status: input.status,
      });
      if (rows.length === 0) return [];

      const inviterIds = Array.from(new Set(rows.map((r) => r.invitedBy)));
      const inviters = await ctx.centralDb
        .select({
          id: centralSchema.users.id,
          name: centralSchema.users.name,
          email: centralSchema.users.email,
        })
        .from(centralSchema.users)
        .where(eq(centralSchema.users.id, inviterIds[0]))
        .all();
      // For multiple inviters, fall back to a per-id loop. Inline to avoid an
      // `inArray` import here when typically only 1-2 inviters per family.
      const inviterMap = new Map(inviters.map((u: typeof inviters[number]) => [u.id, u]));
      for (const id of inviterIds.slice(1)) {
        if (!inviterMap.has(id)) {
          const u = await ctx.centralDb
            .select({
              id: centralSchema.users.id,
              name: centralSchema.users.name,
              email: centralSchema.users.email,
            })
            .from(centralSchema.users)
            .where(eq(centralSchema.users.id, id))
            .get();
          if (u) inviterMap.set(id, u);
        }
      }

      return rows.map((r) => ({
        ...r,
        inviterName: inviterMap.get(r.invitedBy)?.name ?? null,
        inviterEmail: inviterMap.get(r.invitedBy)?.email ?? null,
      }));
    }),

  revokeInvite: platformAdminProcedure
    .input(
      z.object({
        familyId: z.string().min(1),
        invitationId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const inv = await ctx.centralDb
        .select()
        .from(centralSchema.invitations)
        .where(eq(centralSchema.invitations.id, input.invitationId))
        .get();
      if (!inv || inv.familyId !== input.familyId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found' });
      }
      if (inv.revokedAt) {
        return { revoked: false, reason: 'already-revoked' } as const;
      }
      if (inv.acceptedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot revoke an invitation that has already been accepted',
        });
      }

      await revokeInvite(ctx.centralDb, input.invitationId, ctx.platformAdmin.userId);

      const family = await ctx.centralDb
        .select({ name: centralSchema.familyRegistry.name })
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, input.familyId))
        .get();

      const summary = `Platform admin revoked invitation${inv.email ? ` to ${inv.email}` : ''} (${inv.role}) for ${family?.name ?? input.familyId}`;
      await logPlatformActivity(ctx.centralDb, {
        actorUserId: ctx.platformAdmin.userId,
        action: 'family.invite.revoke',
        targetType: 'family',
        targetId: input.familyId,
        summary,
        metadata: {
          invitationId: input.invitationId,
          email: inv.email,
          role: inv.role,
        },
      });
      await logActivity(ctx.centralDb, {
        familyId: input.familyId,
        userId: ctx.platformAdmin.userId,
        action: 'invite_revoked',
        summary,
        metadata: { invitationId: input.invitationId, byPlatformAdmin: true },
      });

      updateTag(`platform-family:${input.familyId}`);
      updateTag('platform-counts');
      updateTag('platform-audit-log');
      return { revoked: true } as const;
    }),

  togglePlatformAdmin: platformAdminProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        value: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Self-demotion guard: forbid revoking your own admin status if you'd
      // be the last one. Operational safety — keep at least 2 platform admins.
      if (input.userId === ctx.platformAdmin.userId && !input.value) {
        const otherCount = await countOtherPlatformAdmins(
          ctx.centralDb,
          ctx.platformAdmin.userId,
        );
        if (otherCount === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Cannot demote yourself — you are the last platform admin. Promote another user first.',
          });
        }
      }

      const target = await ctx.centralDb
        .select({
          id: centralSchema.users.id,
          name: centralSchema.users.name,
          email: centralSchema.users.email,
          isPlatformAdmin: centralSchema.users.isPlatformAdmin,
        })
        .from(centralSchema.users)
        .where(eq(centralSchema.users.id, input.userId))
        .get();

      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const desired = input.value ? 1 : 0;
      if (target.isPlatformAdmin === desired) {
        // No-op — claim already in desired state. Don't audit-log no-ops.
        return { ok: true, changed: false } as const;
      }

      await ctx.centralDb
        .update(centralSchema.users)
        .set({ isPlatformAdmin: desired })
        .where(eq(centralSchema.users.id, input.userId))
        .run();

      // Force JWT refresh so the next request picks up the new claim.
      // Same mechanism family-role changes use (sub-spec A).
      await bumpMembershipsVersion(ctx.centralDb, input.userId);

      await logPlatformActivity(ctx.centralDb, {
        actorUserId: ctx.platformAdmin.userId,
        action: 'platform_admin.toggle',
        targetType: 'user',
        targetId: input.userId,
        summary: input.value
          ? `Promoted ${target.name} (${target.email}) to platform admin`
          : `Demoted ${target.name} (${target.email}) from platform admin`,
        metadata: { previous: target.isPlatformAdmin === 1, next: input.value },
      });

      // Read-your-own-writes: the admin who toggled gets fresh data on their
      // next render. updateTag is the Next 16 primitive for this (vs.
      // revalidateTag which purges globally and now requires a profile arg).
      // Affected: dashboard's platform-admin count, users list (badge column),
      // that user's detail page.
      updateTag('platform-counts');
      updateTag('platform-users');
      updateTag(`platform-user:${input.userId}`);
      updateTag('platform-audit-log');

      return { ok: true, changed: true } as const;
    }),

  // ----- Cross-family member ops (platform-admin override) ---------------
  // Bypass the normal invitation flow to add or relocate members. Logged
  // in BOTH platform_audit_log (cross-family record) AND each affected
  // family's activity feed (so members see who acted).
  // -----------------------------------------------------------------------

  searchFamilies: platformAdminProcedure
    .input(
      z.object({
        q: z.string().optional(),
        excludeFamilyId: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return searchFamilies(ctx.centralDb, {
        q: input.q,
        excludeFamilyId: input.excludeFamilyId,
        limit: input.limit,
      });
    }),

  // limit defaults to 8 because the UserPickerField shows ~8 rows.
  searchUsers: platformAdminProcedure
    .input(
      z.object({
        q: z.string().optional(),
        excludeUserId: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(8),
      }),
    )
    .query(async ({ ctx, input }) => {
      return searchUsers(ctx.centralDb, {
        q: input.q,
        excludeUserId: input.excludeUserId,
        limit: input.limit,
      });
    }),

  /**
   * Provision a new family on behalf of an existing user. Distinct from
   * the user-facing `family.create` (which uses ctx.userId as owner) —
   * this admin path takes an explicit ownerId and records byPlatformAdmin
   * metadata in the audit log.
   */
  createFamily: platformAdminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, 'Family name is required'),
        ownerId: z.string().min(1),
        maxMembers: z.number().int().min(1).max(10000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const owner = await ctx.centralDb
        .select({
          id: centralSchema.users.id,
          name: centralSchema.users.name,
          email: centralSchema.users.email,
        })
        .from(centralSchema.users)
        .where(eq(centralSchema.users.id, input.ownerId))
        .get();
      if (!owner) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Owner user not found',
        });
      }

      const { familyId } = await createFamilyHelper(ctx.centralDb, {
        name: input.name,
        ownerId: input.ownerId,
        maxMembers: input.maxMembers,
      });

      const summary = `Platform admin created family "${input.name}" with ${owner.name} (${owner.email}) as owner`;

      await logPlatformActivity(ctx.centralDb, {
        actorUserId: ctx.platformAdmin.userId,
        action: 'family.create',
        targetType: 'family',
        targetId: familyId,
        summary,
        metadata: {
          familyName: input.name,
          ownerUserId: owner.id,
          ownerName: owner.name,
          ownerEmail: owner.email,
          maxMembers: input.maxMembers ?? null,
          byPlatformAdmin: true,
        },
      });

      await logActivity(ctx.centralDb, {
        familyId,
        userId: ctx.platformAdmin.userId,
        action: 'family_created',
        summary,
        metadata: {
          ownerUserId: owner.id,
          maxMembers: input.maxMembers ?? null,
          byPlatformAdmin: true,
        },
      });

      updateTag('platform-families');
      updateTag('platform-counts');
      updateTag('platform-users');
      updateTag(`platform-user:${owner.id}`);
      updateTag('platform-audit-log');

      return {
        familyId,
        name: input.name,
        ownerName: owner.name,
        ownerEmail: owner.email,
      } as const;
    }),

  // Lightweight memberships lookup for the user-row "Add/Move to another
  // family" flow on /admin/users. Returns only active memberships so the
  // caller can build a source-family picker and exclude existing
  // memberships from the target picker. Owner role is included in the
  // result; the client filters it out for the source picker because the
  // backend's moveMemberToFamily rejects owner moves.
  getUserMemberships: platformAdminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.centralDb
        .select({
          familyId: centralSchema.familyMembers.familyId,
          familyName: centralSchema.familyRegistry.name,
          role: centralSchema.familyMembers.role,
        })
        .from(centralSchema.familyMembers)
        .innerJoin(
          centralSchema.familyRegistry,
          eq(
            centralSchema.familyRegistry.id,
            centralSchema.familyMembers.familyId,
          ),
        )
        .where(
          and(
            eq(centralSchema.familyMembers.userId, input.userId),
            eq(centralSchema.familyMembers.isActive, 1),
          ),
        )
        .orderBy(centralSchema.familyRegistry.name)
        .all();
    }),

  addMemberToFamily: platformAdminProcedure
    .input(
      z.object({
        familyId: z.string().min(1),
        userId: z.string().min(1),
        role: z.enum(['admin', 'editor', 'viewer']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const family = await ctx.centralDb
        .select({ name: centralSchema.familyRegistry.name })
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, input.familyId))
        .get();
      if (!family) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Target family not found' });
      }

      const user = await ctx.centralDb
        .select({
          id: centralSchema.users.id,
          name: centralSchema.users.name,
          email: centralSchema.users.email,
        })
        .from(centralSchema.users)
        .where(eq(centralSchema.users.id, input.userId))
        .get();
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const existing = await ctx.centralDb
        .select({
          id: centralSchema.familyMembers.id,
          role: centralSchema.familyMembers.role,
          isActive: centralSchema.familyMembers.isActive,
        })
        .from(centralSchema.familyMembers)
        .where(
          and(
            eq(centralSchema.familyMembers.familyId, input.familyId),
            eq(centralSchema.familyMembers.userId, input.userId),
          ),
        )
        .get();

      const now = new Date().toISOString();

      if (existing && existing.isActive === 1) {
        // Already an active member — idempotent no-op. Don't audit.
        return {
          added: false,
          alreadyMember: true,
          previousRole: existing.role,
        } as const;
      }

      const reactivated = !!existing;
      if (existing) {
        await ctx.centralDb
          .update(centralSchema.familyMembers)
          .set({
            role: input.role,
            isActive: 1,
            joinedAt: now,
          })
          .where(eq(centralSchema.familyMembers.id, existing.id))
          .run();
      } else {
        await ctx.centralDb
          .insert(centralSchema.familyMembers)
          .values({
            familyId: input.familyId,
            userId: input.userId,
            role: input.role,
            joinedAt: now,
            isActive: 1,
          })
          .run();
      }

      await bumpMembershipsVersion(ctx.centralDb, input.userId);

      const summary = `Platform admin added ${user.name} (${user.email}) as ${input.role} to ${family.name}`;
      await logPlatformActivity(ctx.centralDb, {
        actorUserId: ctx.platformAdmin.userId,
        action: reactivated ? 'family.member.reactivate' : 'family.member.add',
        targetType: 'family',
        targetId: input.familyId,
        summary,
        metadata: {
          targetUserId: input.userId,
          targetUserName: user.name,
          targetUserEmail: user.email,
          role: input.role,
          reactivated,
        },
      });
      await logActivity(ctx.centralDb, {
        familyId: input.familyId,
        userId: ctx.platformAdmin.userId,
        action: 'member_added',
        summary,
        metadata: {
          targetUserId: input.userId,
          role: input.role,
          reactivated,
          byPlatformAdmin: true,
        },
      });

      updateTag(`platform-family:${input.familyId}`);
      updateTag('platform-users');
      updateTag(`platform-user:${input.userId}`);
      updateTag('platform-counts');
      updateTag('platform-audit-log');

      return { added: true, alreadyMember: false, reactivated } as const;
    }),

  moveMemberToFamily: platformAdminProcedure
    .input(
      z.object({
        fromFamilyId: z.string().min(1),
        toFamilyId: z.string().min(1),
        userId: z.string().min(1),
        role: z.enum(['admin', 'editor', 'viewer']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.fromFamilyId === input.toFamilyId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Source and target family must differ',
        });
      }

      const [fromFamily, toFamily, user] = await Promise.all([
        ctx.centralDb
          .select({ name: centralSchema.familyRegistry.name })
          .from(centralSchema.familyRegistry)
          .where(eq(centralSchema.familyRegistry.id, input.fromFamilyId))
          .get(),
        ctx.centralDb
          .select({ name: centralSchema.familyRegistry.name })
          .from(centralSchema.familyRegistry)
          .where(eq(centralSchema.familyRegistry.id, input.toFamilyId))
          .get(),
        ctx.centralDb
          .select({
            id: centralSchema.users.id,
            name: centralSchema.users.name,
            email: centralSchema.users.email,
          })
          .from(centralSchema.users)
          .where(eq(centralSchema.users.id, input.userId))
          .get(),
      ]);
      if (!fromFamily) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Source family not found' });
      }
      if (!toFamily) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Target family not found' });
      }
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const sourceMembership = await ctx.centralDb
        .select({
          id: centralSchema.familyMembers.id,
          role: centralSchema.familyMembers.role,
          isActive: centralSchema.familyMembers.isActive,
        })
        .from(centralSchema.familyMembers)
        .where(
          and(
            eq(centralSchema.familyMembers.familyId, input.fromFamilyId),
            eq(centralSchema.familyMembers.userId, input.userId),
          ),
        )
        .get();
      if (!sourceMembership || sourceMembership.isActive !== 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User is not an active member of the source family',
        });
      }
      if (sourceMembership.role === 'owner') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Cannot move the family owner. Force-transfer ownership first.',
        });
      }

      const targetMembership = await ctx.centralDb
        .select({
          id: centralSchema.familyMembers.id,
          role: centralSchema.familyMembers.role,
          isActive: centralSchema.familyMembers.isActive,
        })
        .from(centralSchema.familyMembers)
        .where(
          and(
            eq(centralSchema.familyMembers.familyId, input.toFamilyId),
            eq(centralSchema.familyMembers.userId, input.userId),
          ),
        )
        .get();
      if (targetMembership && targetMembership.isActive === 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'User is already a member of the target family. Use Remove on the source family instead.',
        });
      }
      const reactivatedAtTarget = !!targetMembership;

      const now = new Date().toISOString();
      const previousRole = sourceMembership.role;

      // Atomic remove-from-source + add-to-target. Explicit BEGIN/COMMIT/
      // ROLLBACK so this works on both better-sqlite3 (sync) and libsql
      // (async) — same pattern transferOwnership uses.
      await ctx.centralDb.run(sql`BEGIN`);
      try {
        await ctx.centralDb
          .update(centralSchema.familyMembers)
          .set({ isActive: 0 })
          .where(eq(centralSchema.familyMembers.id, sourceMembership.id))
          .run();

        if (targetMembership) {
          await ctx.centralDb
            .update(centralSchema.familyMembers)
            .set({
              role: input.role,
              isActive: 1,
              joinedAt: now,
            })
            .where(eq(centralSchema.familyMembers.id, targetMembership.id))
            .run();
        } else {
          await ctx.centralDb
            .insert(centralSchema.familyMembers)
            .values({
              familyId: input.toFamilyId,
              userId: input.userId,
              role: input.role,
              joinedAt: now,
              isActive: 1,
            })
            .run();
        }

        await ctx.centralDb.run(sql`COMMIT`);
      } catch (err) {
        await ctx.centralDb.run(sql`ROLLBACK`);
        throw err;
      }

      await bumpMembershipsVersion(ctx.centralDb, input.userId);

      const summary = `Platform admin moved ${user.name} (${user.email}) from ${fromFamily.name} to ${toFamily.name} as ${input.role}`;

      await logPlatformActivity(ctx.centralDb, {
        actorUserId: ctx.platformAdmin.userId,
        action: 'family.member.move',
        targetType: 'user',
        targetId: input.userId,
        summary,
        metadata: {
          fromFamilyId: input.fromFamilyId,
          fromFamilyName: fromFamily.name,
          toFamilyId: input.toFamilyId,
          toFamilyName: toFamily.name,
          previousRole,
          newRole: input.role,
          reactivatedAtTarget,
        },
      });
      // Family-scoped activity entries — both sides see the override.
      await logActivity(ctx.centralDb, {
        familyId: input.fromFamilyId,
        userId: ctx.platformAdmin.userId,
        action: 'member_removed',
        summary: `Platform admin moved ${user.name} (${previousRole}) to ${toFamily.name}`,
        metadata: {
          targetUserId: input.userId,
          role: previousRole,
          movedToFamilyId: input.toFamilyId,
          byPlatformAdmin: true,
        },
      });
      await logActivity(ctx.centralDb, {
        familyId: input.toFamilyId,
        userId: ctx.platformAdmin.userId,
        action: 'member_added',
        summary: `Platform admin moved ${user.name} from ${fromFamily.name} as ${input.role}`,
        metadata: {
          targetUserId: input.userId,
          role: input.role,
          movedFromFamilyId: input.fromFamilyId,
          reactivated: reactivatedAtTarget,
          byPlatformAdmin: true,
        },
      });

      updateTag(`platform-family:${input.fromFamilyId}`);
      updateTag(`platform-family:${input.toFamilyId}`);
      updateTag('platform-users');
      updateTag(`platform-user:${input.userId}`);
      updateTag('platform-counts');
      updateTag('platform-audit-log');

      return { ok: true, reactivatedAtTarget } as const;
    }),

  // Provision a brand-new user account from the admin surface. Password is
  // required and bcrypt-hashed (cost 10) to match account.signUp. The admin
  // is vouching for the email so emailVerified is set. Optional family
  // membership lets a fresh account land directly in a family without going
  // through the invitation flow.
  createUser: platformAdminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, 'Name is required'),
        email: z
          .string()
          .trim()
          .toLowerCase()
          .email('Invalid email address'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        family: z
          .object({
            familyId: z.string().min(1),
            role: z.enum(['admin', 'editor', 'viewer']),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.centralDb
        .select({ id: centralSchema.users.id })
        .from(centralSchema.users)
        .where(eq(centralSchema.users.email, input.email))
        .get();
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An account with this email already exists',
        });
      }

      let family: { id: string; name: string; memberCount: number; maxMembers: number } | null = null;
      if (input.family) {
        const f = await ctx.centralDb
          .select({
            id: centralSchema.familyRegistry.id,
            name: centralSchema.familyRegistry.name,
            maxMembers: centralSchema.familyRegistry.maxMembers,
          })
          .from(centralSchema.familyRegistry)
          .where(eq(centralSchema.familyRegistry.id, input.family.familyId))
          .get();
        if (!f) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Target family not found' });
        }
        const countRow = await ctx.centralDb
          .select({ n: sql<number>`COUNT(*)` })
          .from(centralSchema.familyMembers)
          .where(
            and(
              eq(centralSchema.familyMembers.familyId, input.family.familyId),
              eq(centralSchema.familyMembers.isActive, 1),
            ),
          )
          .get();
        family = {
          id: f.id,
          name: f.name,
          maxMembers: f.maxMembers,
          memberCount: Number(countRow?.n ?? 0),
        };
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      const newUserId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Explicit BEGIN/COMMIT/ROLLBACK — Drizzle's db.transaction(async ...)
      // rejects on better-sqlite3, per the project rule.
      await ctx.centralDb.run(sql`BEGIN`);
      try {
        await ctx.centralDb
          .insert(centralSchema.users)
          .values({
            id: newUserId,
            name: input.name,
            email: input.email,
            passwordHash,
            emailVerified: 1,
          })
          .run();

        if (input.family) {
          await ctx.centralDb
            .insert(centralSchema.familyMembers)
            .values({
              familyId: input.family.familyId,
              userId: newUserId,
              role: input.family.role,
              joinedAt: now,
              isActive: 1,
            })
            .run();
        }

        await ctx.centralDb.run(sql`COMMIT`);
      } catch (err) {
        await ctx.centralDb.run(sql`ROLLBACK`);
        throw err;
      }

      if (input.family) {
        await bumpMembershipsVersion(ctx.centralDb, newUserId);
      }

      const summary = family
        ? `Platform admin created user ${input.name} (${input.email}) and added as ${input.family!.role} to ${family.name}`
        : `Platform admin created user ${input.name} (${input.email})`;

      await logPlatformActivity(ctx.centralDb, {
        actorUserId: ctx.platformAdmin.userId,
        action: 'user.create',
        targetType: 'user',
        targetId: newUserId,
        summary,
        metadata: {
          targetUserName: input.name,
          targetUserEmail: input.email,
          family: family
            ? { id: family.id, name: family.name, role: input.family!.role }
            : null,
        },
      });

      if (input.family && family) {
        await logActivity(ctx.centralDb, {
          familyId: input.family.familyId,
          userId: ctx.platformAdmin.userId,
          action: 'member_added',
          summary,
          metadata: {
            targetUserId: newUserId,
            role: input.family.role,
            byPlatformAdmin: true,
            createdNewUser: true,
          },
        });
      }

      updateTag('platform-users');
      updateTag('platform-counts');
      updateTag(`platform-user:${newUserId}`);
      updateTag('platform-audit-log');
      if (input.family) {
        updateTag(`platform-family:${input.family.familyId}`);
        updateTag('platform-families');
      }

      return {
        userId: newUserId,
        email: input.email,
        addedToFamily: family ? { id: family.id, name: family.name } : null,
        capExceeded: family
          ? family.memberCount + 1 > family.maxMembers
          : false,
      } as const;
    }),
});
