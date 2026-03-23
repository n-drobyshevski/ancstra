import { NextResponse } from 'next/server';
import { rebuildClosureTable, rebuildAllSummaries } from '@ancstra/db';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function POST() {
  try {
    const { familyDb } = await withAuth('settings:manage');
    await rebuildClosureTable(familyDb);
    await rebuildAllSummaries(familyDb);
    return NextResponse.json({ success: true, message: 'Closure table and summaries rebuilt' });
  } catch (error) {
    return handleAuthError(error);
  }
}
