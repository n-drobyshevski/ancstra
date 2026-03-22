import { NextResponse } from 'next/server';
import { searchPersonsFts } from '@/lib/queries';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('tree:view');

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    if (!q || !q.trim())
      return NextResponse.json(
        { error: 'Query parameter q is required' },
        { status: 400 },
      );

    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('limit') ?? '10')),
    );
    const persons = searchPersonsFts(familyDb, q, limit);
    return NextResponse.json({ persons });
  } catch (error) {
    return handleAuthError(error);
  }
}
