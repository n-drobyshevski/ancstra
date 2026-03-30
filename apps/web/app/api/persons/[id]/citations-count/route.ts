import { NextResponse } from 'next/server';
import { sourceCitations } from '@ancstra/db';
import { eq, count } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('tree:view');
    const { id } = await params;

    const result = await familyDb
      .select({ value: count() })
      .from(sourceCitations)
      .where(eq(sourceCitations.personId, id))
      .get();

    return NextResponse.json({ count: result?.value ?? 0 });
  } catch (error) {
    return handleAuthError(error);
  }
}
