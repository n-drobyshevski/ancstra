import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { generateAuthUrl } from '@ancstra/research';

export async function GET(request: Request) {
  try {
    await withAuth('ai:research', request);

    const clientId = process.env.FAMILYSEARCH_CLIENT_ID;
    const redirectUri = process.env.FAMILYSEARCH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'FamilySearch OAuth not configured' },
        { status: 500 },
      );
    }

    const { url, codeVerifier } = generateAuthUrl(clientId, redirectUri);

    const response = NextResponse.redirect(url);
    response.cookies.set('fs_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    });

    return response;
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[auth/familysearch GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
