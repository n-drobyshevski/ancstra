import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client, ResultSet } from '@libsql/client';

// --- Mock logger so we can assert on warn calls --------------------
const warnMock = vi.fn();
vi.mock('@ancstra/shared', () => ({
  createLogger: () => ({ warn: warnMock, info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

// Set threshold low so we can test both paths deterministically.
process.env.SLOW_QUERY_THRESHOLD_MS = '10';

const { wrapWithSlowQueryLogger } = await import('./slow-query-logger');

// --- Helpers -------------------------------------------------------

function fakeResultSet(): ResultSet {
  return {
    columns: [],
    columnTypes: [],
    rows: [],
    rowsAffected: 0,
    lastInsertRowid: undefined,
    toJSON: () => ({}),
  };
}

function makeClient(executeDelay = 0, batchDelay = 0): Client {
  return {
    execute: vi.fn(async (_stmt: unknown) => {
      if (executeDelay > 0) {
        await new Promise(r => setTimeout(r, executeDelay));
      }
      return fakeResultSet();
    }),
    batch: vi.fn(async (_stmts: unknown, _mode?: unknown) => {
      if (batchDelay > 0) {
        await new Promise(r => setTimeout(r, batchDelay));
      }
      return [fakeResultSet()];
    }),
    transaction: vi.fn(),
    migrate: vi.fn(),
    executeMultiple: vi.fn(),
    sync: vi.fn(),
    close: vi.fn(),
    reconnect: vi.fn(),
    closed: false,
    protocol: 'file',
  } as unknown as Client;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('wrapWithSlowQueryLogger – execute', () => {
  it('does NOT call logger.warn when execute completes faster than threshold', async () => {
    const client = makeClient(0); // 0ms delay → below 10ms threshold
    const wrapped = wrapWithSlowQueryLogger(client);
    const result = await wrapped.execute('SELECT 1');
    expect(result.columns).toEqual([]);
    expect(result.rows).toEqual([]);
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('calls logger.warn with db.slow_query category when execute exceeds threshold', async () => {
    const client = makeClient(30); // 30ms delay → above 10ms threshold
    const wrapped = wrapWithSlowQueryLogger(client);
    await wrapped.execute('SELECT * FROM persons WHERE id = ?');
    expect(warnMock).toHaveBeenCalledOnce();
    const [meta, message] = warnMock.mock.calls[0];
    expect(meta.category).toBe('db.slow_query');
    expect(typeof meta.ms).toBe('number');
    expect(meta.ms).toBeGreaterThan(0);
    expect(message).toBe('slow query');
  });

  it('truncates SQL to 500 chars in the log', async () => {
    const longSql = 'SELECT ' + 'x'.repeat(600);
    const client = makeClient(30);
    const wrapped = wrapWithSlowQueryLogger(client);
    await wrapped.execute(longSql);
    const [meta] = warnMock.mock.calls[0];
    expect(meta.sql.length).toBeLessThanOrEqual(500);
  });

  it('propagates the underlying result on success', async () => {
    const client = makeClient(0);
    const wrapped = wrapWithSlowQueryLogger(client);
    const result = await wrapped.execute({ sql: 'SELECT 1' });
    expect(result).toBeDefined();
    expect(Array.isArray(result.columns)).toBe(true);
  });

  it('propagates thrown errors from execute', async () => {
    const baseClient = {
      ...makeClient(0),
      execute: vi.fn().mockRejectedValue(new Error('db error')),
    } as unknown as Client;
    const wrapped = wrapWithSlowQueryLogger(baseClient);
    await expect(wrapped.execute('SELECT boom')).rejects.toThrow('db error');
  });
});

describe('wrapWithSlowQueryLogger – batch', () => {
  it('calls logger.warn when batch exceeds threshold', async () => {
    const client = makeClient(0, 30);
    const wrapped = wrapWithSlowQueryLogger(client);
    await wrapped.batch(['INSERT INTO t VALUES (1)', 'INSERT INTO t VALUES (2)']);
    expect(warnMock).toHaveBeenCalledOnce();
    const [meta] = warnMock.mock.calls[0];
    expect(meta.category).toBe('db.slow_query');
  });

  it('does NOT warn when batch is fast', async () => {
    const client = makeClient(0, 0);
    const wrapped = wrapWithSlowQueryLogger(client);
    await wrapped.batch(['SELECT 1']);
    expect(warnMock).not.toHaveBeenCalled();
  });
});

describe('wrapWithSlowQueryLogger – pass-through', () => {
  it('passes non-intercepted methods through unchanged', () => {
    const client = makeClient(0);
    const wrapped = wrapWithSlowQueryLogger(client);
    // `close` should be the same function reference (via Reflect.get).
    expect(wrapped.close).toBe(client.close);
    expect(wrapped.closed).toBe(false);
    expect(wrapped.protocol).toBe('file');
  });
});
