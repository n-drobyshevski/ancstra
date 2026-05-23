import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

function makeClient(): Client {
  return {
    execute: vi.fn(async (_stmt: unknown) => fakeResultSet()),
    batch: vi.fn(async (_stmts: unknown, _mode?: unknown) => [fakeResultSet()]),
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

/**
 * Make `performance.now()` deterministic for tests. The wrapped client calls
 * `performance.now()` twice per execute/batch (start + end); this spy returns
 * 0 then `elapsedMs`, so the measured duration is exactly `elapsedMs`.
 *
 * Replaces wall-clock-dependent timing (which flaked on CI under load when
 * the no-delay path took ~12ms vs the 10ms threshold).
 */
function mockElapsed(elapsedMs: number) {
  return vi.spyOn(performance, 'now')
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(elapsedMs);
}

beforeEach(() => {
  warnMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('wrapWithSlowQueryLogger – execute', () => {
  it('does NOT call logger.warn when execute completes faster than threshold', async () => {
    mockElapsed(5); // 5ms < 10ms threshold
    const client = makeClient();
    const wrapped = wrapWithSlowQueryLogger(client);
    const result = await wrapped.execute('SELECT 1');
    expect(result.columns).toEqual([]);
    expect(result.rows).toEqual([]);
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('calls logger.warn with db.slow_query category when execute exceeds threshold', async () => {
    mockElapsed(30); // 30ms > 10ms threshold
    const client = makeClient();
    const wrapped = wrapWithSlowQueryLogger(client);
    await wrapped.execute('SELECT * FROM persons WHERE id = ?');
    expect(warnMock).toHaveBeenCalledOnce();
    const [meta, message] = warnMock.mock.calls[0];
    expect(meta.category).toBe('db.slow_query');
    expect(meta.ms).toBe(30); // deterministic now — was `> 0` because of wall-clock variance
    expect(message).toBe('slow query');
  });

  it('truncates SQL to 500 chars in the log', async () => {
    mockElapsed(30);
    const longSql = 'SELECT ' + 'x'.repeat(600);
    const client = makeClient();
    const wrapped = wrapWithSlowQueryLogger(client);
    await wrapped.execute(longSql);
    const [meta] = warnMock.mock.calls[0];
    expect(meta.sql.length).toBeLessThanOrEqual(500);
  });

  it('propagates the underlying result on success', async () => {
    mockElapsed(5);
    const client = makeClient();
    const wrapped = wrapWithSlowQueryLogger(client);
    const result = await wrapped.execute({ sql: 'SELECT 1' });
    expect(result).toBeDefined();
    expect(Array.isArray(result.columns)).toBe(true);
  });

  it('propagates thrown errors from execute', async () => {
    // No mockElapsed — the throw happens before the second performance.now() is reached.
    const baseClient = {
      ...makeClient(),
      execute: vi.fn().mockRejectedValue(new Error('db error')),
    } as unknown as Client;
    const wrapped = wrapWithSlowQueryLogger(baseClient);
    await expect(wrapped.execute('SELECT boom')).rejects.toThrow('db error');
  });
});

describe('wrapWithSlowQueryLogger – batch', () => {
  it('calls logger.warn when batch exceeds threshold', async () => {
    mockElapsed(30);
    const client = makeClient();
    const wrapped = wrapWithSlowQueryLogger(client);
    await wrapped.batch(['INSERT INTO t VALUES (1)', 'INSERT INTO t VALUES (2)']);
    expect(warnMock).toHaveBeenCalledOnce();
    const [meta] = warnMock.mock.calls[0];
    expect(meta.category).toBe('db.slow_query');
  });

  it('does NOT warn when batch is fast', async () => {
    mockElapsed(5);
    const client = makeClient();
    const wrapped = wrapWithSlowQueryLogger(client);
    await wrapped.batch(['SELECT 1']);
    expect(warnMock).not.toHaveBeenCalled();
  });
});

describe('wrapWithSlowQueryLogger – pass-through', () => {
  it('passes non-intercepted methods through unchanged', () => {
    const client = makeClient();
    const wrapped = wrapWithSlowQueryLogger(client);
    // `close` should be the same function reference (via Reflect.get).
    expect(wrapped.close).toBe(client.close);
    expect(wrapped.closed).toBe(false);
    expect(wrapped.protocol).toBe('file');
  });
});
