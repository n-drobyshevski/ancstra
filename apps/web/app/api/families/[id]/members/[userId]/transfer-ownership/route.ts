import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAuthContext } from '@/lib/auth/context';
import {
  requirePermission,
  transferOwnership,
  logActivity,
  ConcurrentTransferError,
  ForbiddenError,
  type ActivityAction,
} from '@ancstra/auth';
import { createCentralDb } from '@ancstra/db';

type Params = { params: Promise<{ id: string; userId: string }> };

/**
 * POST /api/families/[id]/members/[userId]/transfer-ownership
 * Transfers family ownership from the calling user to the target user.
 * Body: none. Caller must be the current owner of the family in the URL,
 * and the target must currently be an admin in the same family.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id: familyId, userId: targetUserId } = await params;
    const ctx = await requireAuthContext(request);
    requirePermission(ctx.role, 'members:transfer-ownership');

    if (ctx.familyId !== familyId) {
      return NextResponse.json(
        { error: 'Forbidden: not a member of this family' },
        { status: 403 }
      );
    }

    if (ctx.userId === targetUserId) {
      return NextResponse.json(
        { error: 'Cannot transfer ownership to yourself' },
        { status: 400 }
      );
    }

    const centralDb = createCentralDb();
    const result = await transferOwnership(centralDb, {
      familyId,
      currentOwnerId: ctx.userId,
      newOwnerId: targetUserId,
    });

    if (!result.success) {
      const err = result.error ?? '';
      if (err.toLowerCase().includes('not a member')) {
        return NextResponse.json({ error: err }, { status: 404 });
      }
      return NextResponse.json({ error: err || 'Transfer failed' }, { status: 400 });
    }

    await logActivity(centralDb, {
      familyId,
      userId: ctx.userId,
      action: 'owner_transferred' as ActivityAction,
      summary: `Transferred ownership to a new owner`,
      metadata: { previousOwnerId: ctx.userId, newOwnerId: targetUserId },
    });
    revalidateTag('activity', 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ConcurrentTransferError) {
      return NextResponse.json(
        { code: 'CONCURRENT_TRANSFER', error: error.message },
        { status: 409 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes('Not authenticated')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }
}
