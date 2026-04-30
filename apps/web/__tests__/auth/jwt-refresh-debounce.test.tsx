// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { runRefresh } from '@/lib/trpc/jwt-refresh-debounce';

const mockToastInfo = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    info: (msg: string) => mockToastInfo(msg),
    error: (msg: string) => mockToastError(msg),
  },
}));

function makeQueryClient(
  invalidateDelay?: number,
): QueryClient & { invalidateQueries: ReturnType<typeof vi.fn> } {
  const invalidateQueries = invalidateDelay
    ? vi.fn(
        () =>
          new Promise<void>((resolve) => setTimeout(resolve, invalidateDelay)),
      )
    : vi.fn(() => Promise.resolve());
  return { invalidateQueries } as unknown as QueryClient & {
    invalidateQueries: ReturnType<typeof vi.fn>;
  };
}

describe('runRefresh (jwt-refresh-debounce)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-scope inFlight singleton between tests by re-importing
    // via the module registry — we achieve isolation by awaiting any in-flight
    // promise from the previous test (there should be none after each await).
  });

  it('coalesces concurrent calls — updateFn, invalidateQueries, and toast each fire exactly once', async () => {
    const updateFn = vi.fn(() => Promise.resolve());
    const qc = makeQueryClient();

    // Fire two calls in parallel before the first resolves
    const [p1, p2] = await Promise.allSettled([
      runRefresh(updateFn, qc, 'Access updated'),
      runRefresh(updateFn, qc, 'Access updated'),
    ]);

    expect(p1.status).toBe('fulfilled');
    expect(p2.status).toBe('fulfilled');
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(mockToastInfo).toHaveBeenCalledTimes(1);
  });

  it('sequential calls fire independently — updateFn called twice, two toasts', async () => {
    const updateFn = vi.fn(() => Promise.resolve());
    const qc = makeQueryClient();

    await runRefresh(updateFn, qc, 'Access updated');
    await runRefresh(updateFn, qc, 'Access updated');

    expect(updateFn).toHaveBeenCalledTimes(2);
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(mockToastInfo).toHaveBeenCalledTimes(2);
  });

  it('invalidateQueries is awaited before toast fires', async () => {
    const callOrder: string[] = [];

    const updateFn = vi.fn(() => Promise.resolve());
    const invalidateQueries = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          // Resolve async so we can track ordering
          Promise.resolve().then(() => {
            callOrder.push('invalidate');
            resolve();
          });
        }),
    );
    mockToastInfo.mockImplementation(() => {
      callOrder.push('toast');
    });

    const qc = { invalidateQueries } as unknown as QueryClient;
    await runRefresh(updateFn, qc, 'Access updated');

    expect(callOrder).toEqual(['invalidate', 'toast']);
  });

  it('fires error toast when updateFn rejects', async () => {
    const failingUpdate = vi.fn().mockRejectedValue(new Error('auth failed'));
    const qc = makeQueryClient();

    await expect(runRefresh(failingUpdate, qc, 'irrelevant')).rejects.toThrow('auth failed');

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith('Session refresh failed — please reload');
    expect(mockToastInfo).not.toHaveBeenCalled();
  });

  it('errors clear inFlight so a subsequent call starts fresh', async () => {
    const failingUpdate = vi.fn(() => Promise.reject(new Error('auth failed')));
    const successUpdate = vi.fn(() => Promise.resolve());
    const qc = makeQueryClient();

    // First call should throw
    await expect(runRefresh(failingUpdate, qc, 'Access updated')).rejects.toThrow(
      'auth failed',
    );

    // inFlight must be null now — second call must not reuse the rejected promise
    await runRefresh(successUpdate, qc, 'Access updated');

    expect(successUpdate).toHaveBeenCalledTimes(1);
    expect(mockToastInfo).toHaveBeenCalledTimes(1);
  });
});
