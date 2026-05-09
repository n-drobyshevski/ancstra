import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

const createFamilyMock = vi.fn();

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock('@ancstra/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/auth')>();
  return {
    ...original,
    createFamily: (...args: unknown[]) => createFamilyMock(...args),
  };
});

// Build a fake family DB that records every `db.insert(table).values(...).run()` call.
type InsertCall = { table: unknown; values: unknown };
const insertCalls: InsertCall[] = [];
function makeFakeFamilyDb() {
  return {
    insert(table: unknown) {
      return {
        values(values: unknown) {
          insertCalls.push({ table, values });
          return {
            run: vi.fn().mockResolvedValue(undefined),
          };
        },
      };
    },
  };
}

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    createCentralDb: vi.fn(() => ({} as never)),
    createFamilyDb: vi.fn(() => makeFakeFamilyDb() as never),
    ensureFamilySchema: vi.fn(async () => undefined),
  };
});

import { persons, personNames, events } from '@ancstra/db';

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

beforeEach(() => {
  vi.clearAllMocks();
  insertCalls.length = 0;
  createFamilyMock.mockResolvedValue({ familyId: 'f1', dbFilename: 'family-f1.sqlite' });
});

describe('family.create with seed payload', () => {
  it('seed=blank: only creates the registry; no persons inserted', async () => {
    const caller = createCaller(authedCtx());
    await caller.family.create({
      name: 'My Family',
      seed: { kind: 'blank' },
    });
    expect(insertCalls).toHaveLength(0);
  });

  it('seed=gedcom: only creates the registry; no persons inserted (import runs in next step)', async () => {
    const caller = createCaller(authedCtx());
    await caller.family.create({
      name: 'My Family',
      seed: { kind: 'gedcom' },
    });
    expect(insertCalls).toHaveLength(0);
  });

  it('seed=root-self: inserts a person row with the chosen sex', async () => {
    const caller = createCaller(authedCtx());
    await caller.family.create({
      name: 'My Family',
      seed: {
        kind: 'root-self',
        givenName: 'Nicolai',
        surname: 'Drobyshevski',
        sex: 'M',
      },
    });
    const personInsert = insertCalls.find((c) => c.table === persons);
    expect(personInsert).toBeDefined();
    expect(personInsert!.values).toMatchObject({
      sex: 'M',
      isLiving: true,
      createdBy: 'u1',
    });
  });

  it('seed=root-self: inserts a primary person_name row', async () => {
    const caller = createCaller(authedCtx());
    await caller.family.create({
      name: 'My Family',
      seed: {
        kind: 'root-self',
        givenName: 'Nicolai',
        surname: 'Drobyshevski',
        sex: 'M',
      },
    });
    const nameInsert = insertCalls.find((c) => c.table === personNames);
    expect(nameInsert).toBeDefined();
    expect(nameInsert!.values).toMatchObject({
      givenName: 'Nicolai',
      surname: 'Drobyshevski',
      nameType: 'birth',
      isPrimary: true,
    });
  });

  it('seed=root-self with birthYear: inserts a birth event', async () => {
    const caller = createCaller(authedCtx());
    await caller.family.create({
      name: 'My Family',
      seed: {
        kind: 'root-self',
        givenName: 'Nicolai',
        surname: 'Drobyshevski',
        sex: 'M',
        birthYear: 1988,
      },
    });
    const eventInsert = insertCalls.find((c) => c.table === events);
    expect(eventInsert).toBeDefined();
    expect(eventInsert!.values).toMatchObject({
      eventType: 'birth',
      dateOriginal: '1988',
    });
  });

  it('seed=root-self without birthYear: no birth event inserted', async () => {
    const caller = createCaller(authedCtx());
    await caller.family.create({
      name: 'My Family',
      seed: {
        kind: 'root-self',
        givenName: 'Nicolai',
        surname: 'Drobyshevski',
        sex: 'F',
      },
    });
    const eventInsert = insertCalls.find((c) => c.table === events);
    expect(eventInsert).toBeUndefined();
  });

  it('seed=root-self: rejects empty given/surname', async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.family.create({
        name: 'My Family',
        seed: { kind: 'root-self', givenName: '', surname: 'D', sex: 'M' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.family.create({
        name: 'My Family',
        seed: { kind: 'root-self', givenName: 'N', surname: '', sex: 'M' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('returns familyId regardless of seed', async () => {
    const caller = createCaller(authedCtx());
    const result = await caller.family.create({
      name: 'My Family',
      seed: { kind: 'blank' },
    });
    expect(result).toMatchObject({ familyId: 'f1' });
  });
});
