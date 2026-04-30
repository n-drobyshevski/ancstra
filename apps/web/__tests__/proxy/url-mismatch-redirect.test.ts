import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// Spy on bumpLastSeenAt BEFORE importing proxy (hoisted by vi.mock)
const bumpLastSeenAtMock = vi.fn().mockResolvedValue(true);

vi.mock('@/lib/auth/last-seen-tracker', () => ({
  bumpLastSeenAt: bumpLastSeenAtMock,
}));

vi.mock('@/lib/db-singleton', () => ({
  getCentralDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          get: vi.fn(async () => ({ v: 1 })),
        }),
      }),
    }),
  })),
  getCentralDbSync: vi.fn(() => {
    const chain = {
      select: () => chain,
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      all: vi.fn(() => []),
    };
    return chain;
  }),
}));

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    ensureCentralSchema: vi.fn(async () => undefined),
  };
});

// Mock auth to be a transparent passthrough
let mockSession: { user: { id: string; memberships: { familyId: string; role: string; dbFilename: string }[]; membershipsVersion: number } } | null = null;

vi.mock('@/auth', () => ({
  auth: vi.fn(
    (handler: (req: NextRequest & { auth: typeof mockSession }) => Promise<Response>) =>
      (req: NextRequest) =>
        handler(Object.assign(req, { auth: mockSession })),
  ),
}));

// Import proxy AFTER mocks are hoisted
const { proxy } = await import('@/proxy');

const noopCtx = { params: Promise.resolve({}) };

function makeRequest(url: string, cookieHeader?: string): NextRequest {
  const headers = new Headers();
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }
  const req = new Request(url, { headers }) as unknown as NextRequest;

  const nextUrl = new URL(url);
  Object.defineProperty(req, 'nextUrl', { value: nextUrl, configurable: true });

  const cookieStore = new Map<string, string>();
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [k, v] = part.trim().split('=');
      if (k && v !== undefined) cookieStore.set(k, v);
    }
  }
  Object.defineProperty(req, 'cookies', {
    value: {
      get: (name: string) => {
        const val = cookieStore.get(name);
        return val !== undefined ? { value: val } : undefined;
      },
    },
    configurable: true,
  });

  return req;
}

describe('proxy: URL-mismatch redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bumpLastSeenAtMock.mockResolvedValue(true);
  });

  it('redirects to clean URL when ?family=BOGUS is not in memberships, preserving other query params', async () => {
    mockSession = {
      user: {
        id: 'u1',
        memberships: [
          { familyId: 'VALID_FAMILY', role: 'owner', dbFilename: 'valid.db' },
        ],
        membershipsVersion: 1,
      },
    };

    // BOGUS not in memberships; also has another query param that must be preserved
    const req = makeRequest(
      'http://localhost/dashboard?family=BOGUS&tab=overview',
      'active-family=VALID_FAMILY',
    );
    const response = (await proxy(req as Parameters<typeof proxy>[0], noopCtx)) as Response;

    // Should redirect (307 or 302)
    expect([307, 302]).toContain(response.status);

    const location = response.headers.get('location');
    expect(location).not.toBeNull();

    const redirectUrl = new URL(location!);
    // family param must be stripped
    expect(redirectUrl.searchParams.has('family')).toBe(false);
    // other params must be preserved
    expect(redirectUrl.searchParams.get('tab')).toBe('overview');
    expect(redirectUrl.pathname).toBe('/dashboard');

    // active-family cookie must be cleared to prevent infinite redirect loop
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/active-family=;/);
    // cookies.delete() may serialize as either `Max-Age=0` or `Expires=Thu, 01 Jan 1970 ...`
    expect(setCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  it('redirects when stale cookie points to deleted family and no query param is present', async () => {
    mockSession = {
      user: {
        id: 'u1',
        memberships: [
          { familyId: 'CURRENT_FAMILY', role: 'owner', dbFilename: 'current.db' },
        ],
        membershipsVersion: 1,
      },
    };

    // No ?family= query param; stale cookie points to DELETED_FAMILY (not in memberships)
    const req = makeRequest(
      'http://localhost/tree',
      'active-family=DELETED_FAMILY',
    );
    const response = (await proxy(req as Parameters<typeof proxy>[0], noopCtx)) as Response;

    // Should redirect because stale cookie family is not in memberships
    expect([307, 302]).toContain(response.status);

    const location = response.headers.get('location');
    expect(location).not.toBeNull();

    const redirectUrl = new URL(location!);
    expect(redirectUrl.searchParams.has('family')).toBe(false);
    expect(redirectUrl.pathname).toBe('/tree');

    // active-family cookie must be cleared — if not, the stale cookie would
    // cause an infinite redirect loop on every subsequent request.
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/active-family=;/);
    // cookies.delete() may serialize as either `Max-Age=0` or `Expires=Thu, 01 Jan 1970 ...`
    expect(setCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  it('does NOT redirect when valid ?family= is in memberships', async () => {
    mockSession = {
      user: {
        id: 'u1',
        memberships: [
          { familyId: 'VALID_FAMILY', role: 'owner', dbFilename: 'valid.db' },
        ],
        membershipsVersion: 1,
      },
    };

    const req = makeRequest('http://localhost/dashboard?family=VALID_FAMILY');
    const response = (await proxy(req as Parameters<typeof proxy>[0], noopCtx)) as Response;

    // Should NOT redirect
    expect([307, 302]).not.toContain(response.status);
    expect(response.headers.get('location')).toBeNull();
  });

  it('does NOT redirect when there is no query param and no cookie (falls through to default selection)', async () => {
    mockSession = {
      user: {
        id: 'u1',
        memberships: [
          { familyId: 'ONLY_FAMILY', role: 'owner', dbFilename: 'only.db' },
        ],
        membershipsVersion: 1,
      },
    };

    // No ?family= and no cookie
    const req = makeRequest('http://localhost/dashboard');
    const response = (await proxy(req as Parameters<typeof proxy>[0], noopCtx)) as Response;

    // Should NOT redirect — falls through to default selection
    expect([307, 302]).not.toContain(response.status);
    expect(response.headers.get('location')).toBeNull();
  });
});
