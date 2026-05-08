import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Session } from 'next-auth';

// auth() and getCentralDb are awaited inside createTRPCContext; mock them so we
// can control the JWT shape and avoid touching a real database. The lens system
// only cares about ctx.role / ctx.actualRole derivations from the cookie.
const authMock = vi.fn();
vi.mock('@/auth', () => ({ auth: () => authMock() }));

vi.mock('@/lib/db-singleton', () => ({
  getCentralDb: vi.fn(async () => ({}) as never),
}));

vi.mock('@ancstra/db', async () => {
  const actual = await vi.importActual<typeof import('@ancstra/db')>('@ancstra/db');
  return {
    ...actual,
    createFamilyDb: vi.fn(() => ({}) as never),
  };
});

// Import after mocks so the module captures them.
import { createTRPCContext } from '@/server/api/init';
import { LENS_COOKIE_NAME } from '@/lib/lens/cookie';

function sessionWith(role: 'owner' | 'admin' | 'editor' | 'viewer', familyId = 'fam-1'): Session {
  return {
    user: {
      id: 'u-1',
      memberships: [
        { familyId, role, dbFilename: 'fam-1.db' },
      ],
    },
    expires: '2099-01-01T00:00:00Z',
  } as unknown as Session;
}

function makeHeaders(parts: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(parts)) h.set(k, v);
  return h;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTRPCContext lens behavior', () => {
  it('uses actual role when no cookie is present', async () => {
    authMock.mockResolvedValueOnce(sessionWith('admin'));
    const ctx = await createTRPCContext({
      headers: makeHeaders({ 'x-family-id': 'fam-1' }),
    });
    expect(ctx.role).toBe('admin');
    expect(ctx.actualRole).toBe('admin');
  });

  it('applies a legitimate downgrade (admin → viewer)', async () => {
    authMock.mockResolvedValueOnce(sessionWith('admin'));
    const ctx = await createTRPCContext({
      headers: makeHeaders({
        'x-family-id': 'fam-1',
        cookie: `${LENS_COOKIE_NAME}=fam-1:viewer`,
      }),
    });
    expect(ctx.role).toBe('viewer');
    expect(ctx.actualRole).toBe('admin');
  });

  it('applies a legitimate downgrade (owner → editor)', async () => {
    authMock.mockResolvedValueOnce(sessionWith('owner'));
    const ctx = await createTRPCContext({
      headers: makeHeaders({
        'x-family-id': 'fam-1',
        cookie: `${LENS_COOKIE_NAME}=fam-1:editor`,
      }),
    });
    expect(ctx.role).toBe('editor');
    expect(ctx.actualRole).toBe('owner');
  });

  it('rejects an escalation attempt (viewer requesting admin)', async () => {
    authMock.mockResolvedValueOnce(sessionWith('viewer'));
    const ctx = await createTRPCContext({
      headers: makeHeaders({
        'x-family-id': 'fam-1',
        cookie: `${LENS_COOKIE_NAME}=fam-1:admin`,
      }),
    });
    expect(ctx.role).toBe('viewer');
    expect(ctx.actualRole).toBe('viewer');
  });

  it('rejects same-role lens (no-op) and returns actual', async () => {
    authMock.mockResolvedValueOnce(sessionWith('admin'));
    const ctx = await createTRPCContext({
      headers: makeHeaders({
        'x-family-id': 'fam-1',
        cookie: `${LENS_COOKIE_NAME}=fam-1:admin`,
      }),
    });
    expect(ctx.role).toBe('admin');
    expect(ctx.actualRole).toBe('admin');
  });

  it('ignores lens when cookie familyId mismatches active family', async () => {
    authMock.mockResolvedValueOnce({
      user: {
        id: 'u-1',
        memberships: [
          { familyId: 'fam-1', role: 'admin', dbFilename: 'a.db' },
          { familyId: 'fam-2', role: 'admin', dbFilename: 'b.db' },
        ],
      },
      expires: '2099-01-01T00:00:00Z',
    } as unknown as Session);
    const ctx = await createTRPCContext({
      headers: makeHeaders({
        'x-family-id': 'fam-2',
        cookie: `${LENS_COOKIE_NAME}=fam-1:viewer`,
      }),
    });
    // Active family is fam-2; cookie targets fam-1 → ignored.
    expect(ctx.role).toBe('admin');
    expect(ctx.actualRole).toBe('admin');
    expect(ctx.familyId).toBe('fam-2');
  });

  it('ignores malformed cookie value gracefully', async () => {
    authMock.mockResolvedValueOnce(sessionWith('admin'));
    const ctx = await createTRPCContext({
      headers: makeHeaders({
        'x-family-id': 'fam-1',
        cookie: `${LENS_COOKIE_NAME}=garbage-no-colon`,
      }),
    });
    expect(ctx.role).toBe('admin');
    expect(ctx.actualRole).toBe('admin');
  });

  it('ignores cookie referencing an unknown role string', async () => {
    authMock.mockResolvedValueOnce(sessionWith('admin'));
    const ctx = await createTRPCContext({
      headers: makeHeaders({
        'x-family-id': 'fam-1',
        cookie: `${LENS_COOKIE_NAME}=fam-1:superadmin`,
      }),
    });
    expect(ctx.role).toBe('admin');
  });

  it('returns null role and actualRole when no session', async () => {
    authMock.mockResolvedValueOnce(null);
    const ctx = await createTRPCContext({
      headers: makeHeaders({
        cookie: `${LENS_COOKIE_NAME}=fam-1:viewer`,
      }),
    });
    expect(ctx.role).toBeNull();
    expect(ctx.actualRole).toBeNull();
  });

  it('co-exists with other cookies in the header', async () => {
    authMock.mockResolvedValueOnce(sessionWith('owner'));
    const ctx = await createTRPCContext({
      headers: makeHeaders({
        'x-family-id': 'fam-1',
        cookie: `sidebar_state=true; ${LENS_COOKIE_NAME}=fam-1:viewer; theme=dark`,
      }),
    });
    expect(ctx.role).toBe('viewer');
    expect(ctx.actualRole).toBe('owner');
  });
});
