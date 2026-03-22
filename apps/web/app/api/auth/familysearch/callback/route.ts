import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { exchangeCodeForTokens } from '@ancstra/research';

export async function GET(request: NextRequest) {
  try {
    await withAuth('ai:research');

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const codeVerifier = request.cookies.get('fs_code_verifier')?.value;

    const clientId = process.env.FAMILYSEARCH_CLIENT_ID;
    const redirectUri = process.env.FAMILYSEARCH_REDIRECT_URI;

    if (!code || !codeVerifier || !clientId || !redirectUri) {
      return NextResponse.redirect(
        new URL('/settings?error=fs_auth_failed', request.url),
      );
    }

    try {
      // TODO: store tokens in NextAuth session
      await exchangeCodeForTokens(code, codeVerifier, clientId, redirectUri);

      const response = NextResponse.redirect(
        new URL('/settings?fs=connected', request.url),
      );
      response.cookies.delete('fs_code_verifier');
      return response;
    } catch {
      return NextResponse.redirect(
        new URL('/settings?error=fs_auth_failed', request.url),
      );
    }
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    return NextResponse.redirect(
      new URL('/settings?error=fs_auth_failed', request.url),
    );
  }
}
