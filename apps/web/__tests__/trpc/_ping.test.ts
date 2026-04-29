import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

// Cut the next-auth import chain — auth() is only called in createTRPCContext,
// which we bypass entirely by supplying a pre-built BaseContext to createCaller.
vi.mock('@/auth', () => ({
  auth: vi.fn(async () => null),
}));

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

function makeCtx(overrides: Partial<BaseContext> = {}): BaseContext {
  return {
    session: null,
    userId: null,
    familyId: null,
    role: null,
    dbFilename: null,
    familyDb: null,
    centralDb: {} as never,
    ...overrides,
  };
}

describe('_ping (synthetic permission tests)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects viewer calling members:manage with FORBIDDEN', async () => {
    const caller = createCaller(
      makeCtx({
        session: { user: { id: 'u1' } } as never,
        userId: 'u1',
        familyId: 'f1',
        role: 'viewer',
        dbFilename: 'fake.db',
        familyDb: {} as never,
      }),
    );
    await expect(caller._ping.membersManage()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows admin to call members:manage', async () => {
    const caller = createCaller(
      makeCtx({
        session: { user: { id: 'u1' } } as never,
        userId: 'u1',
        familyId: 'f1',
        role: 'admin',
        dbFilename: 'fake.db',
        familyDb: {} as never,
      }),
    );
    await expect(caller._ping.membersManage()).resolves.toEqual({
      ok: true,
      role: 'admin',
    });
  });
});
