import { randomBytes } from 'node:crypto';

const FS_AUTH_URL = 'https://ident.familysearch.org/cis-web/oauth2/v3/authorization';
const FS_TOKEN_URL = 'https://ident.familysearch.org/cis-web/oauth2/v3/token';

/**
 * Generate a FamilySearch OAuth authorization URL with PKCE (plain method).
 */
export function generateAuthUrl(
  clientId: string,
  redirectUri: string,
): { url: string; codeVerifier: string } {
  const codeVerifier = randomBytes(32).toString('hex');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeVerifier,
    code_challenge_method: 'plain',
  });

  return {
    url: `${FS_AUTH_URL}?${params.toString()}`,
    codeVerifier,
  };
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const res = await fetch(FS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FamilySearch token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    expiresIn: data.expires_in ?? 3600,
  };
}
