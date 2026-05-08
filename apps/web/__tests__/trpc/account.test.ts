import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

const insertRunMock = vi.fn();
const selectAllMock = vi.fn();
const fakeCentralDb = {
  select: () => ({ from: () => ({ where: () => ({ all: selectAllMock }) }) }),
  insert: () => ({ values: () => ({ run: insertRunMock }) }),
} as never;

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    createCentralDb: vi.fn(() => fakeCentralDb),
    createFamilyDb: vi.fn(() => ({} as never)),
    ensureFamilySchema: vi.fn(async () => undefined),
  };
});

const createCaller = createCallerFactory(appRouter);

function publicCtx(): BaseContext {
  return {
    session: null,
    userId: null,
    familyId: null,
    role: null,
    actualRole: null,
    dbFilename: null,
    familyDb: null,
    centralDb: fakeCentralDb,
  };
}

describe('account.signUp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects duplicate email with CONFLICT', async () => {
    selectAllMock.mockResolvedValueOnce([{ id: 'existing' }]);
    const caller = createCaller(publicCtx());
    await expect(
      caller.account.signUp({
        email: 'taken@example.com',
        password: 'StrongPass1',
        name: 'X',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('inserts a user on first signup', async () => {
    selectAllMock.mockResolvedValueOnce([]);
    insertRunMock.mockResolvedValueOnce(undefined);
    const caller = createCaller(publicCtx());
    const result = await caller.account.signUp({
      email: 'new@example.com',
      password: 'StrongPass1',
      name: 'New User',
    });
    expect(result.email).toBe('new@example.com');
    expect(insertRunMock).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid email', async () => {
    const caller = createCaller(publicCtx());
    await expect(
      caller.account.signUp({
        email: 'not-an-email',
        password: 'StrongPass1',
        name: 'X',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
