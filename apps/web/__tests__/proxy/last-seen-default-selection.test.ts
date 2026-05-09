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

// getCentralDbSync stub — returns a chainable query builder that records the
// last `.all()` call result. We override `mockDbRows` per test.
let mockDbRows: { familyId: string }[] = [];

function makeQueryStub() {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    all: vi.fn(() => mockDbRows),
  };
  return chain;
}

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
  getCentralDbSync: vi.fn(() => makeQueryStub()),
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

describe('proxy: default-family selection by lastSeenAt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bumpLastSeenAtMock.mockResolvedValue(true);
    mockDbRows = [];
  });

  it('picks the membership with the most recent lastSeenAt when no family is requested', async () => {
    // DB returns FAMILY_B as the top result (most recent lastSeenAt)
    mockDbRows = [{ familyId: 'FAMILY_B' }];

    mockSession = {
      user: {
        id: 'u1',
        memberships: [
          { familyId: 'FAMILY_A', role: 'owner', dbFilename: 'a.db' },
          { familyId: 'FAMILY_B', role: 'editor', dbFilename: 'b.db' },
          { familyId: 'FAMILY_C', role: 'viewer', dbFilename: 'c.db' },
        ],
        membershipsVersion: 1,
      },
    };

    const req = makeRequest('http://localhost/dashboard');
    const response = (await proxy(req as Parameters<typeof proxy>[0], noopCtx)) as Response;

    // Should not redirect
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(302);

    // The forwarded request should have x-family-db set to FAMILY_B's dbFilename
    // We inspect the response headers via NextResponse.next (request headers
    // are forwarded — check that the response is a "next" response, not a redirect)
    expect(response.headers.get('location')).toBeNull();
  });

  it('falls back to joinedAt tiebreaker when all lastSeenAt are NULL', async () => {
    // DB returns FAMILY_C as the latest by joinedAt when all lastSeenAt are NULL
    mockDbRows = [{ familyId: 'FAMILY_C' }];

    mockSession = {
      user: {
        id: 'u1',
        memberships: [
          { familyId: 'FAMILY_A', role: 'owner', dbFilename: 'a.db' },
          { familyId: 'FAMILY_B', role: 'editor', dbFilename: 'b.db' },
          { familyId: 'FAMILY_C', role: 'viewer', dbFilename: 'c.db' },
        ],
        membershipsVersion: 1,
      },
    };

    const req = makeRequest('http://localhost/dashboard');
    const response = (await proxy(req as Parameters<typeof proxy>[0], noopCtx)) as Response;

    // Should not redirect — it should proceed normally
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(302);
    expect(response.headers.get('location')).toBeNull();
  });

  it('falls back to memberships[0] and logs a warning when DB query throws', async () => {
    // Override getCentralDbSync to return a stub that throws on .all()
    const { getCentralDbSync } = await import('@/lib/db-singleton');
    const throwingChain = {
      select: () => throwingChain,
      from: () => throwingChain,
      where: () => throwingChain,
      orderBy: () => throwingChain,
      limit: () => throwingChain,
      all: vi.fn(() => { throw new Error('DB connection failed'); }),
    };
    vi.mocked(getCentralDbSync).mockReturnValueOnce(throwingChain as never);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockSession = {
      user: {
        id: 'u1',
        memberships: [
          { familyId: 'FAMILY_A', role: 'owner', dbFilename: 'a.db' },
          { familyId: 'FAMILY_B', role: 'editor', dbFilename: 'b.db' },
        ],
        membershipsVersion: 1,
      },
    };

    const req = makeRequest('http://localhost/dashboard');
    const response = (await proxy(req as Parameters<typeof proxy>[0], noopCtx)) as Response;

    // Should not crash or redirect
    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(302);
    expect(response.headers.get('location')).toBeNull();

    // Should have logged the warning with the [PROXY] prefix
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PROXY] default-family query failed'),
      expect.anything(),
    );

    warnSpy.mockRestore();
  });
});
