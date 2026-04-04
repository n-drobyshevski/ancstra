import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/context';
import { requirePermission, ForbiddenError, logActivity, type Role, type ActivityAction } from '@ancstra/auth';
import { createCentralDb, createFamilyDb, centralSchema, familyUserCache } from '@ancstra/db';
import { revalidateTag } from 'next/cache';
import { eq, and } from 'drizzle-orm';

type Params = { params: Promise<{ id: string; userId: string }> };

const ASSIGNABLE_ROLES = ['admin', 'editor', 'viewer'] as const;

/**
 * PATCH /api/families/[id]/members/[userId]
 * Update a member's role. Requires members:manage permission.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: familyId, userId: targetUserId } = await params;
    const ctx = await requireAuthContext();
    requirePermission(ctx.role, 'members:manage');

    if (ctx.familyId !== familyId) {
      return NextResponse.json(
        { error: 'Forbidden: not a member of this family' },
        { status: 403 }
      );
    }

    // Cannot change own role
    if (ctx.userId === targetUserId) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const newRole = body.role as string;

    // Validate the new role
    if (!ASSIGNABLE_ROLES.includes(newRole as typeof ASSIGNABLE_ROLES[number])) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${ASSIGNABLE_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    const centralDb = createCentralDb();

    // Get target member's current membership
    const targetMember = await centralDb
      .select()
      .from(centralSchema.familyMembers)
      .where(
        and(
          eq(centralSchema.familyMembers.familyId, familyId),
          eq(centralSchema.familyMembers.userId, targetUserId),
          eq(centralSchema.familyMembers.isActive, 1)
        )
      )
      .get();

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Admin can only change editor/viewer roles (not other admins or owner)
    if (ctx.role === 'admin') {
      if (targetMember.role === 'owner' || targetMember.role === 'admin') {
        return NextResponse.json(
          { error: 'Admins cannot change the role of owners or other admins' },
          { status: 403 }
        );
      }
    }

    // Update the role
    await centralDb
      .update(centralSchema.familyMembers)
      .set({ role: newRole as 'owner' | 'admin' | 'editor' | 'viewer' })
      .where(eq(centralSchema.familyMembers.id, targetMember.id))
      .run();

    // Fetch updated member with user details
    const updated = await centralDb
      .select({
        id: centralSchema.familyMembers.id,
        userId: centralSchema.familyMembers.userId,
        role: centralSchema.familyMembers.role,
        joinedAt: centralSchema.familyMembers.joinedAt,
        name: centralSchema.users.name,
        email: centralSchema.users.email,
      })
      .from(centralSchema.familyMembers)
      .innerJoin(
        centralSchema.users,
        eq(centralSchema.familyMembers.userId, centralSchema.users.id)
      )
      .where(eq(centralSchema.familyMembers.id, targetMember.id))
      .get();

    await logActivity(centralDb, {
      familyId,
      userId: ctx.userId,
      action: 'role_changed' as ActivityAction,
      summary: `Changed ${updated?.name ?? 'a member'}'s role to ${newRole}`,
      metadata: { targetUserId, oldRole: targetMember.role, newRole },
    });
    revalidateTag('activity', 'max');

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes('Not authenticated')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }
}

/**
 * DELETE /api/families/[id]/members/[userId]
 * Remove a member from the family. Requires members:manage permission.
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id: familyId, userId: targetUserId } = await params;
    const ctx = await requireAuthContext();
    requirePermission(ctx.role, 'members:manage');

    if (ctx.familyId !== familyId) {
      return NextResponse.json(
        { error: 'Forbidden: not a member of this family' },
        { status: 403 }
      );
    }

    const centralDb = createCentralDb();

    // Get the target member
    const targetMember = await centralDb
      .select()
      .from(centralSchema.familyMembers)
      .where(
        and(
          eq(centralSchema.familyMembers.familyId, familyId),
          eq(centralSchema.familyMembers.userId, targetUserId),
          eq(centralSchema.familyMembers.isActive, 1)
        )
      )
      .get();

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Owner cannot remove themselves (use transfer flow instead)
    if (targetMember.role === 'owner' && ctx.userId === targetUserId) {
      return NextResponse.json(
        { error: 'Owner cannot remove themselves. Transfer ownership first.' },
        { status: 400 }
      );
    }

    // Admin cannot remove owner or other admins
    if (ctx.role === 'admin') {
      if (targetMember.role === 'owner' || targetMember.role === 'admin') {
        return NextResponse.json(
          { error: 'Admins cannot remove owners or other admins' },
          { status: 403 }
        );
      }
    }

    // Deactivate in central DB
    await centralDb
      .update(centralSchema.familyMembers)
      .set({ isActive: 0 })
      .where(eq(centralSchema.familyMembers.id, targetMember.id))
      .run();

    // Remove from familyUserCache in the family DB
    try {
      const familyDb = createFamilyDb(ctx.dbFilename);
      await familyDb
        .delete(familyUserCache)
        .where(eq(familyUserCache.userId, targetUserId))
        .run();
    } catch {
      // Family DB may not exist yet — not critical
    }

    await logActivity(centralDb, {
      familyId,
      userId: ctx.userId,
      action: 'member_removed' as ActivityAction,
      summary: 'Removed a member from the family',
      metadata: { targetUserId, role: targetMember.role },
    });
    revalidateTag('activity', 'max');

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes('Not authenticated')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }
}
