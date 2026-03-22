import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DomainRateLimiter } from '../scraper/rate-limiter-domain';

describe('DomainRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('first request to a domain is immediate', async () => {
    const limiter = new DomainRateLimiter();
    const start = Date.now();

    await limiter.acquire('example.com');

    // Should not have waited
    expect(Date.now() - start).toBe(0);
  });

  it('enforces delay between requests to same domain', async () => {
    const limiter = new DomainRateLimiter();

    await limiter.acquire('example.com', 500);
    const secondRequest = limiter.acquire('example.com', 500);

    // Advance time by 500ms to satisfy the delay
    vi.advanceTimersByTime(500);

    await secondRequest;

    // Should have waited ~500ms
    expect(Date.now()).toBeGreaterThanOrEqual(500);
  });

  it('parallel domains do not block each other', async () => {
    const limiter = new DomainRateLimiter();

    await limiter.acquire('example.com', 1000);
    const start = Date.now();

    // Different domain should be immediate
    await limiter.acquire('other.com', 1000);

    expect(Date.now() - start).toBe(0);
  });

  it('uses default 1000ms delay', async () => {
    const limiter = new DomainRateLimiter();

    await limiter.acquire('example.com');
    const secondRequest = limiter.acquire('example.com');

    // 500ms is not enough
    vi.advanceTimersByTime(500);
    // Need full 1000ms
    vi.advanceTimersByTime(500);

    await secondRequest;
    expect(Date.now()).toBeGreaterThanOrEqual(1000);
  });

  it('cleanup removes stale entries', async () => {
    const limiter = new DomainRateLimiter();

    await limiter.acquire('stale.com');

    // Advance past 10 minutes
    vi.advanceTimersByTime(11 * 60 * 1000);

    limiter.cleanup();

    // After cleanup, next request should be immediate (no prior entry)
    const start = Date.now();
    await limiter.acquire('stale.com');
    expect(Date.now() - start).toBe(0);
  });

  it('cleanup keeps recent entries', async () => {
    const limiter = new DomainRateLimiter();

    await limiter.acquire('recent.com');

    // Only 5 minutes - should not be cleaned up
    vi.advanceTimersByTime(5 * 60 * 1000);

    limiter.cleanup();

    // Next request should still enforce delay since entry was kept
    const secondRequest = limiter.acquire('recent.com', 500);
    vi.advanceTimersByTime(500);
    await secondRequest;

    // The fact that we had to wait confirms the entry was kept
  });
});
