import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    createCentralDb: vi.fn(() => ({} as never)),
    createFamilyDb: vi.fn(() => ({} as never)),
    ensureFamilySchema: vi.fn(async () => undefined),
  };
});

// Mock getTreeData so we don't need a real DB connection.
vi.mock('@/lib/queries', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/queries')>();
  return {
    ...original,
    getTreeData: vi.fn(async () => ({
      persons: [],
      families: [],
      childLinks: [],
    })),
  };
});

// Mock the serializer to return a minimal GEDCOM string.
vi.mock('@/lib/gedcom/serialize', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/gedcom/serialize')>();
  return {
    ...original,
    serializeToGedcom: vi.fn(() => '0 HEAD\n0 TRLR\n'),
  };
});

const createCaller = createCallerFactory(appRouter);

function ctxWithRole(role: 'viewer' | 'editor' | 'admin' | 'owner'): BaseContext {
  return {
    session: { user: { id: 'u1' } } as never,
    userId: 'u1',
    familyId: 'f1',
    role,
    dbFilename: 'fake.db',
    // Provide a minimal stub that satisfies db.select().from(events).all()
    familyDb: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          all: vi.fn(async () => []),
        })),
      })),
    } as never,
    centralDb: {} as never,
  };
}

describe('gedcom.export', () => {
  beforeEach(() => vi.clearAllMocks());

  it('editor receives base64-encoded GEDCOM body', async () => {
    const caller = createCaller(ctxWithRole('editor'));
    const result = await caller.gedcom.export(undefined);
    expect(result.encoding).toBe('base64');
    const decoded = Buffer.from(result.gedcom, 'base64').toString('utf8');
    expect(decoded).toContain('HEAD');
    expect(decoded).toContain('TRLR');
  });

  it('owner also receives base64-encoded GEDCOM body', async () => {
    const caller = createCaller(ctxWithRole('owner'));
    const result = await caller.gedcom.export({ mode: 'shareable' });
    expect(result.encoding).toBe('base64');
    expect(Buffer.from(result.gedcom, 'base64').toString('utf8')).toContain('HEAD');
  });

  it('viewer is denied (no gedcom:export permission)', async () => {
    const caller = createCaller(ctxWithRole('viewer'));
    await expect(caller.gedcom.export(undefined)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
