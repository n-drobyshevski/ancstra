import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../providers/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within the limit', async () => {
    const limiter = new RateLimiter(60); // 60 per minute = 1 per second

    // Should be able to acquire a few tokens immediately
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    // If we got here without hanging, the test passes
    expect(true).toBe(true);
  });

  it('blocks when rate limit is exceeded', async () => {
    const limiter = new RateLimiter(2); // Only 2 per minute

    // Exhaust all tokens
    await limiter.acquire();
    await limiter.acquire();

    // Third acquire should not resolve immediately
    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // Give microtasks a chance to flush
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(false);

    // Advance time so tokens refill (30 seconds = 1 token at 2/min)
    await vi.advanceTimersByTimeAsync(30_000);
    await promise;
    expect(resolved).toBe(true);
  });

  it('refills tokens over time', async () => {
    const limiter = new RateLimiter(60); // 1 per second

    // Exhaust all tokens
    for (let i = 0; i < 60; i++) {
      await limiter.acquire();
    }

    // Should be blocked now
    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(false);

    // Advance 1 second — should refill 1 token
    await vi.advanceTimersByTimeAsync(1_000);
    await promise;
    expect(resolved).toBe(true);
  });
});
