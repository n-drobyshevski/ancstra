import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

const createFamilyMock = vi.fn();

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));

vi.mock('@ancstra/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/auth')>();
  return {
    ...original,
    createFamily: (...args: unknown[]) => createFamilyMock(...args),
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

const createCaller = createCallerFactory(appRouter);

function authedCtx(): BaseContext {
  return {
    session: { user: { id: 'u1' } } as never,
    userId: 'u1',
    familyId: null,
    role: null,
    dbFilename: null,
    familyDb: null,
    centralDb: {} as never,
  };
}

describe('family.create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns familyId on success', async () => {
    createFamilyMock.mockResolvedValueOnce({ familyId: 'f1' });
    const caller = createCaller(authedCtx());
    const result = await caller.family.create({ name: 'My Family' });
    expect(result).toEqual({ familyId: 'f1' });
  });

  it('rejects empty / whitespace name', async () => {
    const caller = createCaller(authedCtx());
    await expect(caller.family.create({ name: '   ' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('throws UNAUTHORIZED when no session', async () => {
    const caller = createCaller({
      session: null,
      userId: null,
      familyId: null,
      role: null,
      dbFilename: null,
      familyDb: null,
      centralDb: {} as never,
    });
    await expect(caller.family.create({ name: 'X' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
