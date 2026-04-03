import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAuthContext } from '@/lib/auth/context';
import { requirePermission, reviewContribution, logActivity, type ActivityAction } from '@ancstra/auth';
import { createFamilyDb, createCentralDb } from '@ancstra/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; contributionId: string }> }
) {
  const { contributionId } = await params;
  const ctx = await requireAuthContext();
  requirePermission(ctx.role, 'contributions:review');

  const body = await request.json();
  const familyDb = createFamilyDb(ctx.dbFilename);

  const result = await reviewContribution(familyDb, {
    contributionId,
    reviewerId: ctx.userId,
    action: body.action,
    comment: body.comment,
  });

  if (result.alreadyReviewed) {
    return NextResponse.json({ error: 'Already reviewed' }, { status: 409 });
  }

  const centralDb = createCentralDb();
  await logActivity(centralDb, {
    familyId: ctx.familyId,
    userId: ctx.userId,
    action: (body.action === 'approve' ? 'contribution_approved' : 'contribution_rejected') as ActivityAction,
    summary: `${body.action === 'approve' ? 'Approved' : 'Rejected'} a contribution`,
    metadata: { contributionId, comment: body.comment },
  });
  revalidateTag('activity', 'max');

  return NextResponse.json(result);
}
