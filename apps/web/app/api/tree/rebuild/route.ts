import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { rebuildClosureTable, rebuildAllSummaries } from '@ancstra/db';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function POST() {
  try {
    const { familyDb } = await withAuth('settings:manage');
    await rebuildClosureTable(familyDb);
    await rebuildAllSummaries(familyDb);
    revalidateTag('tree-data', 'max');
    revalidateTag('persons', 'max');
    revalidateTag('dashboard', 'max');
    return NextResponse.json({ success: true, message: 'Closure table and summaries rebuilt' });
  } catch (error) {
    console.error('[tree/rebuild] error:', error);
    return handleAuthError(error);
  }
}
