import { describe, it, expect, vi, beforeEach } from 'vitest';

const { redirectMock, signInMock, getCentralDbMock, hashMock, validateInviteMock, acceptInviteMock, logActivityMock, bumpVersionMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    const err = new Error(`NEXT_REDIRECT:${path}`);
    (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${path};307;`;
    throw err;
  }),
  signInMock: vi.fn(async () => undefined),
  getCentralDbMock: vi.fn(),
  hashMock: vi.fn(async () => 'HASH'),
  validateInviteMock: vi.fn(),
  acceptInviteMock: vi.fn(async () => ({
    id: 'inv-1',
    familyId: 'fam-1',
    invitedBy: 'u-other',
    email: null,
    role: 'editor',
    token: 'abc',
    expiresAt: '2099',
    acceptedAt: '2026-05-09',
    acceptedBy: 'u-new',
    revokedAt: null,
    revokedBy: null,
    createdAt: '2026-05-09',
  })),
  logActivityMock: vi.fn(async () => undefined),
  bumpVersionMock: vi.fn(async () => undefined),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('@/auth', () => ({ signIn: signInMock }));
vi.mock('@/lib/db-singleton', () => ({ getCentralDb: getCentralDbMock }));
vi.mock('bcryptjs', () => ({ default: { hash: hashMock } }));
vi.mock('@ancstra/auth', () => ({
  validateInviteToken: validateInviteMock,
  acceptInvite: acceptInviteMock,
  logActivity: logActivityMock,
  bumpMembershipsVersion: bumpVersionMock,
}));

import { signUpAndAcceptAction } from '@/server/api/routers/auth/_actions';

// Build a fake centralDb that returns no existing user and successfully
// inserts. The test threads a per-test `existingUser` flag via the mock
// closure to flip between "email available" and "email already taken".
type DbRow = { id: string; email: string };
function makeCentralDb({ existingUser = null as DbRow | null, insertedUserId = 'u-new' as string } = {}) {
  const insertCalls: Array<{ values: unknown }> = [];
  return {
    insertCalls,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            all: async () => (existingUser ? [existingUser] : []),
            get: async () => (existingUser ?? null),
          }),
        }),
      }),
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          insertCalls.push({ values });
          return {
            returning: () => ({
              get: async () => ({ id: insertedUserId, email: (values.email ?? '') as string }),
            }),
            run: async () => undefined,
          };
        },
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  redirectMock.mockImplementation((path: string) => {
    const err = new Error(`NEXT_REDIRECT:${path}`);
    (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${path};307;`;
    throw err;
  });
  hashMock.mockResolvedValue('HASH');
});

async function runAction(input: { name: string; email: string; password: string; token: string }) {
  try {
    const result = await signUpAndAcceptAction(input);
    return { redirected: null as string | null, result };
  } catch (err) {
    const digest = (err as { digest?: string }).digest;
    if (digest && digest.startsWith('NEXT_REDIRECT;')) {
      return { redirected: digest.split(';')[2] ?? null, result: null };
    }
    throw err;
  }
}

describe('signUpAndAcceptAction', () => {
  const baseInput = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    token: 'invite-token',
  };

  it('happy path: validates invite, creates user, signs in, accepts invite, redirects to /dashboard?family=…&invite=accepted', async () => {
    const fake = makeCentralDb();
    getCentralDbMock.mockResolvedValue(fake.db as never);
    validateInviteMock.mockResolvedValue({
      valid: true,
      invitation: { id: 'inv-1', familyId: 'fam-1', email: null, role: 'editor', token: 'invite-token' },
    });

    const out = await runAction(baseInput);

    expect(validateInviteMock).toHaveBeenCalled();
    expect(fake.insertCalls.length).toBeGreaterThan(0);
    expect(signInMock).toHaveBeenCalledWith('credentials', expect.objectContaining({
      email: 'test@example.com',
      password: 'password123',
      redirect: false,
    }));
    expect(acceptInviteMock).toHaveBeenCalledWith(expect.anything(), 'invite-token', 'u-new');
    expect(out.redirected).toBe('/dashboard?family=fam-1&invite=accepted');
  });

  it('returns error when invite is invalid (revoked / expired / accepted)', async () => {
    const fake = makeCentralDb();
    getCentralDbMock.mockResolvedValue(fake.db as never);
    validateInviteMock.mockResolvedValue({
      valid: false,
      reason: 'Invitation has expired',
    });

    const out = await runAction(baseInput);
    expect(out.redirected).toBeNull();
    expect(out.result).toMatchObject({ message: 'Invitation has expired' });
    expect(fake.insertCalls).toHaveLength(0);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('returns email field error when email-locked invite does not match submitted email', async () => {
    const fake = makeCentralDb();
    getCentralDbMock.mockResolvedValue(fake.db as never);
    // validateInviteToken in production checks invitation.email vs userEmail
    // and returns this specific reason when they differ. The action must
    // surface that into the email field so the form can highlight it.
    validateInviteMock.mockResolvedValue({
      valid: false,
      reason: 'Email does not match invitation',
    });

    const out = await runAction({ ...baseInput, email: 'test@example.com' });
    expect(out.redirected).toBeNull();
    expect(out.result?.errors?.email?.[0]).toMatch(/email/i);
    expect(fake.insertCalls).toHaveLength(0);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('returns error when email is already registered', async () => {
    const fake = makeCentralDb({ existingUser: { id: 'u-existing', email: 'test@example.com' } });
    getCentralDbMock.mockResolvedValue(fake.db as never);
    validateInviteMock.mockResolvedValue({
      valid: true,
      invitation: { id: 'inv-1', familyId: 'fam-1', email: null, role: 'editor', token: 'invite-token' },
    });

    const out = await runAction(baseInput);
    expect(out.redirected).toBeNull();
    expect(out.result?.errors?.email).toBeDefined();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('rejects invalid signup payload (short password)', async () => {
    const fake = makeCentralDb();
    getCentralDbMock.mockResolvedValue(fake.db as never);
    validateInviteMock.mockResolvedValue({ valid: true, invitation: { id: 'i', familyId: 'f', email: null, role: 'viewer', token: 't' } });

    const out = await runAction({ ...baseInput, password: 'short' });
    expect(out.redirected).toBeNull();
    expect(out.result?.errors?.password).toBeDefined();
    expect(validateInviteMock).not.toHaveBeenCalled();
  });
});
