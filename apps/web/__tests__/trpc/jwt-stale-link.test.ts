import { describe, it, expect, vi } from 'vitest';
import { TRPCClientError } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import { jwtStaleLink } from '@/lib/trpc/jwt-stale-link';

describe('jwtStaleLink', () => {
  it('triggers onJwtStale on TRPCClientError with code JWT_STALE', () => {
    const onJwtStale = vi.fn();
    const link = jwtStaleLink({ onJwtStale });

    const next = vi.fn(() =>
      observable<unknown, TRPCClientError<never>>((observer) => {
        const err = new TRPCClientError('Session stale, please retry');
        (err as unknown as { data: { code: string; httpStatus: number } }).data = {
          code: 'JWT_STALE',
          httpStatus: 409,
        };
        observer.error(err);
      }),
    );

    const op = { id: 1, type: 'mutation' as const, path: 'test', input: {}, context: {} };
    const fakeRuntime = {} as never;
    const subscription = link(fakeRuntime)({ op, next, prev: vi.fn() } as never).subscribe({
      error: () => undefined,
    });

    expect(onJwtStale).toHaveBeenCalledTimes(1);
    subscription.unsubscribe?.();
  });

  it('does not trigger onJwtStale on other errors', () => {
    const onJwtStale = vi.fn();
    const link = jwtStaleLink({ onJwtStale });

    const next = vi.fn(() =>
      observable<unknown, TRPCClientError<never>>((observer) => {
        const err = new TRPCClientError('Forbidden');
        (err as unknown as { data: { code: string; httpStatus: number } }).data = {
          code: 'FORBIDDEN',
          httpStatus: 403,
        };
        observer.error(err);
      }),
    );

    const op = { id: 1, type: 'mutation' as const, path: 'test', input: {}, context: {} };
    const fakeRuntime = {} as never;
    const subscription = link(fakeRuntime)({ op, next, prev: vi.fn() } as never).subscribe({
      error: () => undefined,
    });

    expect(onJwtStale).not.toHaveBeenCalled();
    subscription.unsubscribe?.();
  });

  it('passes successful results through unchanged', () => {
    const onJwtStale = vi.fn();
    const link = jwtStaleLink({ onJwtStale });
    const result = vi.fn();

    const next = vi.fn(() =>
      observable<unknown, TRPCClientError<never>>((observer) => {
        observer.next({ result: { type: 'data', data: { ok: true } } } as never);
        observer.complete();
      }),
    );

    const op = { id: 1, type: 'query' as const, path: 'test', input: {}, context: {} };
    const fakeRuntime = {} as never;
    const subscription = link(fakeRuntime)({ op, next, prev: vi.fn() } as never).subscribe({
      next: result,
    });

    expect(result).toHaveBeenCalledTimes(1);
    expect(onJwtStale).not.toHaveBeenCalled();
    subscription.unsubscribe?.();
  });
});
