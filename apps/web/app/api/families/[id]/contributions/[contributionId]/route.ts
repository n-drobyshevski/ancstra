import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/context';
import { requirePermission, reviewContribution } from '@ancstra/auth';
import { createFamilyDb } from '@ancstra/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; contributionId: string }> }
) {
  const { contributionId } = await params;
  const ctx = await requireAuthContext();
  requirePermission(ctx.role, 'contributions:review');

  const body = await request.json();
  const familyDb = createFamilyDb(ctx.dbFilename);

  const result = reviewContribution(familyDb, {
    contributionId,
    reviewerId: ctx.userId,
    action: body.action,
    comment: body.comment,
  });

  if (result.alreadyReviewed) {
    return NextResponse.json({ error: 'Already reviewed' }, { status: 409 });
  }

  return NextResponse.json(result);
}
