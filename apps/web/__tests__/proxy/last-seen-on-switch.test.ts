import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse, type NextRequest } from 'next/server';

// Mock next-intl/middleware to a no-op passthrough.
vi.mock('next-intl/middleware', () => ({
  default: () => () => NextResponse.next(),
}));

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
  getCentralDbSync: vi.fn(() => ({} as never)),
}));

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    ensureCentralSchema: vi.fn(async () => undefined),
  };
});

// Mock auth to be a transparent passthrough: auth(handler) returns a function
// that calls handler with a request augmented with request.auth = mockSession.
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

// NextAuth route handler ctx — proxy is a middleware and ignores params,
// but TypeScript requires the second argument.
const noopCtx = { params: Promise.resolve({}) };

function makeRequest(url: string, cookieHeader?: string): NextRequest {
  const headers = new Headers();
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }
  // NextRequest is a superset of Request; in the test environment the built-in
  // Request + nextUrl are sufficient because proxy only uses request.nextUrl and
  // request.cookies.
  const req = new Request(url, { headers }) as unknown as NextRequest;

  // Attach nextUrl (Next.js middleware API — proxy reads searchParams from it)
  const nextUrl = new URL(url);
  Object.defineProperty(req, 'nextUrl', { value: nextUrl, configurable: true });

  // Attach cookies (Next.js ReadonlyRequestCookies API subset)
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

describe('proxy: lastSeenAt on family switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bumpLastSeenAtMock.mockResolvedValue(true);
  });

  it('calls bumpLastSeenAt once when ?family=NEW differs from cookie active-family=OLD', async () => {
    mockSession = {
      user: {
        id: 'u1',
        memberships: [
          { familyId: 'OLD', role: 'owner', dbFilename: 'old.db' },
          { familyId: 'NEW', role: 'owner', dbFilename: 'new.db' },
        ],
        membershipsVersion: 1,
      },
    };

    const req = makeRequest('http://localhost/tree?family=NEW', 'active-family=OLD');
    await proxy(req as Parameters<typeof proxy>[0], noopCtx);

    expect(bumpLastSeenAtMock).toHaveBeenCalledOnce();
    expect(bumpLastSeenAtMock).toHaveBeenCalledWith(expect.anything(), 'u1', 'NEW');
  });

  it('does NOT call bumpLastSeenAt when ?family= matches cookie active-family', async () => {
    mockSession = {
      user: {
        id: 'u1',
        memberships: [{ familyId: 'SAME', role: 'owner', dbFilename: 'same.db' }],
        membershipsVersion: 1,
      },
    };

    const req = makeRequest('http://localhost/tree?family=SAME', 'active-family=SAME');
    await proxy(req as Parameters<typeof proxy>[0], noopCtx);

    expect(bumpLastSeenAtMock).not.toHaveBeenCalled();
  });

  it('does NOT call bumpLastSeenAt when there is no ?family= query param', async () => {
    mockSession = {
      user: {
        id: 'u1',
        memberships: [{ familyId: 'SAME', role: 'owner', dbFilename: 'same.db' }],
        membershipsVersion: 1,
      },
    };

    const req = makeRequest('http://localhost/tree', 'active-family=SAME');
    await proxy(req as Parameters<typeof proxy>[0], noopCtx);

    expect(bumpLastSeenAtMock).not.toHaveBeenCalled();
  });

  it('does NOT call bumpLastSeenAt when ?family= is invalid (URL-mismatch redirect path)', async () => {
    mockSession = {
      user: {
        id: 'u1',
        memberships: [{ familyId: 'VALID', role: 'admin', dbFilename: 'valid.db' }],
        membershipsVersion: 1,
      },
    };

    // Request asks for a family the user is not a member of — triggers URL-mismatch redirect.
    const req = makeRequest('http://localhost/dashboard?family=BOGUS_FAMILY');
    const response = await proxy(req as Parameters<typeof proxy>[0], noopCtx) as Response;

    // The proxy should redirect (307/302) before reaching the cookie-set/bump block.
    expect(bumpLastSeenAtMock).not.toHaveBeenCalled();
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    // Redirect URL must not contain the bogus family param.
    const location = response.headers.get('location') ?? '';
    expect(location).not.toContain('BOGUS_FAMILY');
  });
});
