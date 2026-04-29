import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

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

// Mock the parser to avoid real parse-gedcom dependency in tests.
vi.mock('@/lib/gedcom/parse', () => ({
  parseGedcomFile: vi.fn(() => []),
  parseGedcomString: vi.fn(() => []),
}));

// Mock the mapper to return a deterministic fixture.
vi.mock('@/lib/gedcom/mapper', () => ({
  mapGedcomToImport: vi.fn(() => ({
    persons: [],
    names: [],
    families: [],
    childLinks: [],
    events: [],
    warnings: [],
    stats: { persons: 0, families: 0, events: 0, skippedSources: 0 },
  })),
}));

// Mock logActivity so it doesn't hit a real DB.
vi.mock('@ancstra/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/auth')>();
  return {
    ...original,
    logActivity: vi.fn(async () => undefined),
  };
});

const createCaller = createCallerFactory(appRouter);

function makeTransactionStub() {
  return vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
    // Provide a stub tx with .insert().values().run()
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          run: vi.fn(async () => undefined),
        })),
      })),
    };
    await fn(tx);
  });
}

function ctxWithRole(role: 'viewer' | 'editor' | 'admin' | 'owner'): BaseContext {
  return {
    session: { user: { id: 'u1' } } as never,
    userId: 'u1',
    familyId: 'f1',
    role,
    dbFilename: 'fake.db',
    // Provide a minimal stub that satisfies db.select().from(events).all()
    // and db.transaction() for commitImport.
    familyDb: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          all: vi.fn(async () => []),
          where: vi.fn(() => ({
            all: vi.fn(async () => [{ count: 0 }]),
          })),
        })),
      })),
      transaction: makeTransactionStub(),
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

describe('gedcom.previewImport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('viewer cannot preview-import', async () => {
    const caller = createCaller(ctxWithRole('viewer'));
    await expect(
      caller.gedcom.previewImport({ gedcomBase64: 'AA==' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('editor cannot preview-import (gedcom:import is admin+owner only)', async () => {
    const caller = createCaller(ctxWithRole('editor'));
    await expect(
      caller.gedcom.previewImport({ gedcomBase64: 'AA==' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('admin can preview-import and receives stats', async () => {
    const caller = createCaller(ctxWithRole('admin'));
    const result = await caller.gedcom.previewImport({
      gedcomBase64: Buffer.from('0 HEAD\n0 TRLR', 'utf8').toString('base64'),
    });
    expect(result).toBeDefined();
    expect(result).toHaveProperty('stats');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('existingPersonCount');
  });

  it('owner can preview-import and receives stats', async () => {
    const caller = createCaller(ctxWithRole('owner'));
    const result = await caller.gedcom.previewImport({
      gedcomBase64: Buffer.from('0 HEAD\n0 TRLR', 'utf8').toString('base64'),
      filename: 'family.ged',
    });
    expect(result.stats).toMatchObject({ persons: 0, families: 0, events: 0 });
  });
});

describe('gedcom.commitImport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('viewer cannot commit-import', async () => {
    const caller = createCaller(ctxWithRole('viewer'));
    await expect(
      caller.gedcom.commitImport({ gedcomBase64: 'AA==' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('editor cannot commit-import (gedcom:import is admin+owner only)', async () => {
    const caller = createCaller(ctxWithRole('editor'));
    await expect(
      caller.gedcom.commitImport({ gedcomBase64: 'AA==' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('admin can commit-import and receives imported counts', async () => {
    const caller = createCaller(ctxWithRole('admin'));
    const result = await caller.gedcom.commitImport({
      gedcomBase64: Buffer.from('0 HEAD\n0 TRLR', 'utf8').toString('base64'),
    });
    expect(result).toHaveProperty('imported');
    expect(result.imported).toMatchObject({ persons: 0, families: 0, events: 0 });
  });

  it('owner can commit-import and receives imported counts', async () => {
    const caller = createCaller(ctxWithRole('owner'));
    const result = await caller.gedcom.commitImport({
      gedcomBase64: Buffer.from('0 HEAD\n0 TRLR', 'utf8').toString('base64'),
      filename: 'family.ged',
    });
    expect(result.imported).toMatchObject({ persons: 0, families: 0, events: 0 });
  });
});
