import { NextResponse } from 'next/server';
import { getPriorities } from '@ancstra/db';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('tree:view');
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));

    const result = await getPriorities(familyDb, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return handleAuthError(error);
  }
}
