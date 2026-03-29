import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { listAllFactsheetLinks } from '@ancstra/research';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const links = await listAllFactsheetLinks(familyDb);
    return NextResponse.json({ links });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheet-links GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
