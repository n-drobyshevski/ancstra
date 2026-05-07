import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
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
} from '@ancstra/auth';
import {
  countOtherPlatformAdmins,
  listAuditLog,
  listAuditLogActions,
  logPlatformActivity,
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
});
