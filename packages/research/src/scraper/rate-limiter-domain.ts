const DEFAULT_DELAY_MS = 1000;
const CLEANUP_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Per-domain rate limiter that enforces a minimum delay between
 * requests to the same domain.
 */
export class DomainRateLimiter {
  private lastRequestTime = new Map<string, number>();

  /**
   * Wait until enough time has passed since the last request to this domain.
   * First request to a domain is immediate.
   *
   * @param domain - The domain to rate-limit
   * @param delayMs - Minimum delay between requests in milliseconds (default 1000)
   */
  async acquire(domain: string, delayMs?: number): Promise<void> {
    const delay = delayMs ?? DEFAULT_DELAY_MS;
    const lastTime = this.lastRequestTime.get(domain);
    const now = Date.now();

    if (lastTime !== undefined) {
      const elapsed = now - lastTime;
      if (elapsed < delay) {
        const waitTime = delay - elapsed;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.lastRequestTime.set(domain, Date.now());
  }

  /**
   * Remove entries that haven't been used in over 10 minutes
   * to prevent memory leaks from long-running processes.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [domain, lastTime] of this.lastRequestTime) {
      if (now - lastTime > CLEANUP_THRESHOLD_MS) {
        this.lastRequestTime.delete(domain);
      }
    }
  }
}
