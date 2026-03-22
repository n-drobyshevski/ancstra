import { NextResponse } from 'next/server';
import { getQualitySummary } from '@ancstra/db';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function GET() {
  try {
    const { familyDb } = await withAuth('tree:view');
    const summary = getQualitySummary(familyDb);
    return NextResponse.json(summary);
  } catch (error) {
    return handleAuthError(error);
  }
}
