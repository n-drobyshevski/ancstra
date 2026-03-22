import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/context';
import { requirePermission, getPendingContributions } from '@ancstra/auth';
import { createFamilyDb } from '@ancstra/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const ctx = await requireAuthContext();
  requirePermission(ctx.role, 'contributions:review');

  const familyDb = createFamilyDb(ctx.dbFilename);
  const contributions = getPendingContributions(familyDb);

  return NextResponse.json(contributions);
}
