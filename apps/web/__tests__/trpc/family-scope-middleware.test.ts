import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BaseContext } from '@/server/api/init';

const ensureFamilySchemaMock = vi.fn(
  async (_db: unknown, _dbKey?: string): Promise<void> => undefined,
);

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));

vi.mock('@/lib/db-singleton', () => ({
  getCentralDb: vi.fn(async () => ({}) as never),
}));

vi.mock('@ancstra/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...actual,
    createFamilyDb: vi.fn(() => ({}) as never),
    ensureFamilySchema: (...args: Parameters<typeof actual.ensureFamilySchema>) =>
      ensureFamilySchemaMock(...args),
  };
});

// Import after mocks so the modules capture them.
import { t, createTRPCContext } from '@/server/api/init';
import { familyScopeMiddleware } from '@/server/api/middleware/family-scope';

// Tiny isolated router that exercises ONLY familyScopeMiddleware (no session
// or permission middleware). Lets us assert the middleware's behaviour
// directly without cross-talk from the rest of the protectedProcedure chain.
const isolatedRouter = t.router({
  echo: t.procedure.use(familyScopeMiddleware).query(({ ctx }) => ({
    familyId: ctx.familyId,
    role: ctx.role,
    dbFilename: ctx.dbFilename,
  })),
});

const createIsolatedCaller = t.createCallerFactory(isolatedRouter);

function fullCtx(): BaseContext {
  return {
    session: { user: { id: 'u1' } } as never,
    userId: 'u1',
    familyId: 'fam-1',
    role: 'owner',
    actualRole: 'owner',
    dbFilename: 'fam-1.db',
    familyDb: {} as never,
    centralDb: {} as never,
  };
}

function makeHeaders(parts: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(parts)) h.set(k, v);
  return h;
}

beforeEach(() => {
  vi.clearAllMocks();
  ensureFamilySchemaMock.mockResolvedValue(undefined);
});

describe('familyScopeMiddleware — ctx integrity guard', () => {
  it.each([
    ['familyId', { familyId: null }],
    ['role', { role: null }],
    ['familyDb', { familyDb: null }],
    ['dbFilename', { dbFilename: null }],
  ] as const)('throws FORBIDDEN when ctx.%s is missing', async (_field, override) => {
    const caller = createIsolatedCaller({ ...fullCtx(), ...override });
    await expect(caller.echo()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'No active family membership for this request',
    });
    // ensureFamilySchema must not be called when the guard short-circuits.
    expect(ensureFamilySchemaMock).not.toHaveBeenCalled();
  });

  it('throws INTERNAL_SERVER_ERROR with the underlying cause when ensureFamilySchema rejects', async () => {
    const dbErr = new Error('disk I/O error');
    ensureFamilySchemaMock.mockRejectedValueOnce(dbErr);
    const caller = createIsolatedCaller(fullCtx());
    await expect(caller.echo()).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Family schema init failed for fam-1',
      cause: dbErr,
    });
  });

  it('passes ctx through to the procedure on success', async () => {
    const caller = createIsolatedCaller(fullCtx());
    const result = await caller.echo();
    expect(result).toEqual({ familyId: 'fam-1', role: 'owner', dbFilename: 'fam-1.db' });
    expect(ensureFamilySchemaMock).toHaveBeenCalledTimes(1);
    expect(ensureFamilySchemaMock).toHaveBeenCalledWith({}, 'fam-1.db');
  });
});

describe('cross-family bleed: forged x-family-id is refused upstream', () => {
  it('createTRPCContext returns null-fielded ctx when x-family-id does not match any membership', async () => {
    const authMod = await import('@/auth');
    vi.mocked(authMod.auth).mockResolvedValueOnce({
      user: {
        id: 'u-attacker',
        memberships: [
          // User only belongs to family A
          { familyId: 'fam-A', role: 'owner', dbFilename: 'fam-A.db' },
        ],
      },
      expires: '2099-01-01T00:00:00Z',
    } as never);

    const ctx = await createTRPCContext({
      headers: makeHeaders({ 'x-family-id': 'fam-B' }), // attempting to act on family B
    });

    expect(ctx.familyId).toBeNull();
    expect(ctx.role).toBeNull();
    expect(ctx.familyDb).toBeNull();
    expect(ctx.dbFilename).toBeNull();
  });

  it('familyScopeMiddleware then throws FORBIDDEN on that null ctx', async () => {
    const authMod = await import('@/auth');
    vi.mocked(authMod.auth).mockResolvedValueOnce({
      user: {
        id: 'u-attacker',
        memberships: [
          { familyId: 'fam-A', role: 'owner', dbFilename: 'fam-A.db' },
        ],
      },
      expires: '2099-01-01T00:00:00Z',
    } as never);

    const ctx = await createTRPCContext({
      headers: makeHeaders({ 'x-family-id': 'fam-B' }),
    });
    const caller = createIsolatedCaller(ctx);
    await expect(caller.echo()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
