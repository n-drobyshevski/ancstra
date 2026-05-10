import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock '@sentry/nextjs' before importing timing.ts so the module under
// test uses the spy instead of the real SDK.
const startSpanMock = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  startSpan: startSpanMock,
}));

// Dynamic import after vi.mock so hoisting works correctly.
const { withSpan, timeQuery } = await import('./timing');

beforeEach(() => {
  vi.resetAllMocks();
  // Default: delegate to the callback so the real return value flows through.
  startSpanMock.mockImplementation((_opts: unknown, cb: () => unknown) => cb());
});

describe('withSpan', () => {
  it('returns the inner result when Sentry is initialized', async () => {
    const result = await withSpan('test.span', async () => 42);
    expect(result).toBe(42);
  });

  it('returns the inner result when Sentry is NOT initialized (startSpan throws)', async () => {
    // Simulate an uninitialised Sentry that throws from startSpan itself.
    startSpanMock.mockImplementation(() => {
      throw new Error('Sentry not initialised');
    });
    const result = await withSpan('test.span', async () => 'fallback');
    expect(result).toBe('fallback');
  });

  it('propagates errors thrown by fn', async () => {
    const boom = new Error('inner error');
    // startSpan delegates to fn; fn throws.
    startSpanMock.mockImplementation((_opts: unknown, cb: () => unknown) => cb());
    await expect(withSpan('test.span', async () => { throw boom; })).rejects.toThrow('inner error');
  });

  it('calls Sentry.startSpan with the expected name and attributes', async () => {
    const attrs = { family_id: 'f1', person_id: 'p1' };
    await withSpan('my.span', async () => 'ok', attrs);
    expect(startSpanMock).toHaveBeenCalledWith(
      { name: 'my.span', attributes: attrs },
      expect.any(Function),
    );
  });
});

describe('timeQuery', () => {
  it('returns the inner result synchronously', () => {
    const result = timeQuery('db.query', () => 99);
    expect(result).toBe(99);
  });

  it('calls Sentry.startSpan with op db.query and correct name + attributes', () => {
    const attrs = { table: 'persons' };
    timeQuery('db.query.persons', () => 'rows', attrs);
    expect(startSpanMock).toHaveBeenCalledWith(
      { name: 'db.query.persons', attributes: attrs, op: 'db.query' },
      expect.any(Function),
    );
  });
});
