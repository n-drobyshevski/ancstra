import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/context';
import { requirePermission, ForbiddenError } from '@ancstra/auth';
import { createCentralDb, centralSchema } from '@ancstra/db';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/families/[id]/members
 * List all active members of a family with user details.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: familyId } = await params;
    const ctx = await requireAuthContext();
    requirePermission(ctx.role, 'members:manage');

    // Verify the request is for the user's current family
    if (ctx.familyId !== familyId) {
      return NextResponse.json(
        { error: 'Forbidden: not a member of this family' },
        { status: 403 }
      );
    }

    const centralDb = createCentralDb();

    const members = await centralDb
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
      .where(
        and(
          eq(centralSchema.familyMembers.familyId, familyId),
          eq(centralSchema.familyMembers.isActive, 1)
        )
      )
      .all();

    return NextResponse.json(members);
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
 * POST /api/families/[id]/members
 * Not implemented — member creation is handled via invitations.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use invitations to add members.' },
    { status: 405 }
  );
}
