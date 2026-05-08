import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import * as centralSchema from '@ancstra/db/central-schema';
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
vi.mock('@ancstra/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/auth')>();
  return { ...original, logActivity: vi.fn(async () => undefined) };
});

// Parser + mapper return one fake person so we can assert the values
// pushed to the persons insert.
vi.mock('@/lib/gedcom/parse', () => ({
  parseGedcomFile: vi.fn(() => []),
  parseGedcomString: vi.fn(() => []),
}));
vi.mock('@/lib/gedcom/mapper', () => ({
  mapGedcomToImport: vi.fn(() => ({
    persons: [{ id: 'p1', sex: 'F', isLiving: true, notes: null }],
    names: [],
    families: [],
    childLinks: [],
    events: [],
    warnings: [],
    stats: { persons: 1, families: 0, events: 0, skippedSources: 0 },
  })),
}));

const createCaller = createCallerFactory(appRouter);

interface CapturedRows {
  personRows: unknown[];
}

function familyDbStub(captured: CapturedRows) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ all: vi.fn(async () => [{ count: 0 }]) }),
      }),
    }),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        insert: vi.fn((table: unknown) => ({
          values: vi.fn((rows: unknown) => {
            // Use Drizzle's getTableName helper so we capture only the
            // `persons` table insert and ignore the other tables in the
            // 6-insert sequence.
            try {
              if (getTableName(table as Parameters<typeof getTableName>[0]) === 'persons') {
                captured.personRows = Array.isArray(rows) ? rows : [rows];
              }
            } catch {
              /* not a table — ignore */
            }
            return { run: vi.fn(async () => undefined) };
          }),
        })),
      };
      await fn(tx);
    }),
  } as never;
}

async function seedFamily(
  db: TestCentralDb,
  defaultPrivacyLevel: 'public' | 'private' | 'restricted',
) {
  const now = new Date().toISOString();
  await db.insert(centralSchema.users).values({
    id: 'u1', email: 'a@x.com', name: 'A', createdAt: now, updatedAt: now,
  }).run();
  await db.insert(centralSchema.familyRegistry).values({
    id: 'f1', name: 'F', ownerId: 'u1', dbFilename: 'fake.db',
    defaultPrivacyLevel, createdAt: now, updatedAt: now,
  }).run();
  await db.insert(centralSchema.familyMembers).values({
    id: 'm1', familyId: 'f1', userId: 'u1', role: 'admin', joinedAt: now, isActive: 1,
  }).run();
}

function ctx(centralDb: TestCentralDb, familyDb: BaseContext['familyDb']): BaseContext {
  return {
    session: { user: { id: 'u1' } } as never,
    userId: 'u1',
    familyId: 'f1',
    role: 'admin',
    actualRole: 'admin',
    dbFilename: 'fake.db',
    familyDb,
    centralDb: centralDb as never,
  };
}

describe('gedcom.commitImport applies family.defaultPrivacyLevel', () => {
  beforeEach(() => vi.clearAllMocks());

  it("imported persons get privacyLevel='public' when family default is public", async () => {
    const central = createTestCentralDb();
    await seedFamily(central, 'public');
    const captured: CapturedRows = { personRows: [] };
    const caller = createCaller(ctx(central, familyDbStub(captured)));

    await caller.gedcom.commitImport({
      gedcomBase64: Buffer.from('0 HEAD\n0 TRLR', 'utf8').toString('base64'),
    });

    expect(captured.personRows).toHaveLength(1);
    expect((captured.personRows[0] as { privacyLevel: string }).privacyLevel).toBe('public');
  });

  it("imported persons get privacyLevel='restricted' when family default is restricted", async () => {
    const central = createTestCentralDb();
    await seedFamily(central, 'restricted');
    const captured: CapturedRows = { personRows: [] };
    const caller = createCaller(ctx(central, familyDbStub(captured)));

    await caller.gedcom.commitImport({
      gedcomBase64: Buffer.from('0 HEAD\n0 TRLR', 'utf8').toString('base64'),
    });

    expect((captured.personRows[0] as { privacyLevel: string }).privacyLevel).toBe('restricted');
  });
});
