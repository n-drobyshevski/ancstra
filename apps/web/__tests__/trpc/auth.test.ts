import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

const acceptInviteMock = vi.fn();
const logActivityMock = vi.fn();

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => null),
}));

vi.mock('@ancstra/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/auth')>();
  return {
    ...original,
    acceptInvite: (...args: unknown[]) => acceptInviteMock(...args),
    logActivity: (...args: unknown[]) => logActivityMock(...args),
  };
});

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    createCentralDb: vi.fn(() => ({} as never)),
    createFamilyDb: vi.fn(() => ({} as never)),
    ensureFamilySchema: vi.fn(async () => undefined),
  };
});

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const createCaller = createCallerFactory(appRouter);

function authedCtx(): BaseContext {
  return {
    session: { user: { id: 'u1' } } as never,
    userId: 'u1',
    familyId: null,
    role: null,
    actualRole: null,
    dbFilename: null,
    familyDb: null,
    centralDb: {} as never,
  };
}

describe('auth.acceptInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns familyId on success', async () => {
    acceptInviteMock.mockResolvedValueOnce({ familyId: 'f1' });
    const caller = createCaller(authedCtx());
    const result = await caller.auth.acceptInvite({ token: 'good-token' });
    expect(result).toEqual({ familyId: 'f1' });
    expect(acceptInviteMock).toHaveBeenCalledWith(
      expect.anything(),
      'good-token',
      'u1',
    );
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        familyId: 'f1',
        userId: 'u1',
        action: 'invite_accepted',
      }),
    );
  });

  it('throws BAD_REQUEST when accept fails', async () => {
    acceptInviteMock.mockRejectedValueOnce(new Error('Invalid invitation'));
    const caller = createCaller(authedCtx());
    await expect(
      caller.auth.acceptInvite({ token: 'bad-token' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('throws UNAUTHORIZED when no session', async () => {
    const caller = createCaller({
      session: null,
      userId: null,
      familyId: null,
      role: null,
      actualRole: null,
      dbFilename: null,
      familyDb: null,
      centralDb: {} as never,
    });
    await expect(
      caller.auth.acceptInvite({ token: 'good-token' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects empty token at validation', async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.auth.acceptInvite({ token: '' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
