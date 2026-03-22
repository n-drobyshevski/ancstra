import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RobotsChecker } from '../scraper/robots';

function mockFetch(body: string, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  }) as unknown as typeof globalThis.fetch;
}

describe('RobotsChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows when no robots.txt (404)', async () => {
    const fetch = mockFetch('', 404);
    const checker = new RobotsChecker(fetch);

    const allowed = await checker.isAllowed('https://example.com/some/page');

    expect(allowed).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('allows when fetch fails', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error')) as unknown as typeof globalThis.fetch;
    const checker = new RobotsChecker(fetch);

    const allowed = await checker.isAllowed('https://example.com/page');

    expect(allowed).toBe(true);
  });

  it('allows paths not in Disallow', async () => {
    const robotsTxt = `
User-agent: *
Disallow: /private/
Disallow: /admin/
    `;
    const checker = new RobotsChecker(mockFetch(robotsTxt));

    expect(await checker.isAllowed('https://example.com/public/page')).toBe(
      true
    );
    expect(await checker.isAllowed('https://example.com/')).toBe(true);
  });

  it('blocks disallowed paths', async () => {
    const robotsTxt = `
User-agent: *
Disallow: /private/
Disallow: /admin/
    `;
    const checker = new RobotsChecker(mockFetch(robotsTxt));

    expect(await checker.isAllowed('https://example.com/private/data')).toBe(
      false
    );
    expect(
      await checker.isAllowed('https://example.com/admin/settings')
    ).toBe(false);
  });

  it('respects Ancstra-specific user agent rules', async () => {
    const robotsTxt = `
User-agent: *
Disallow: /blocked-for-all/

User-agent: Ancstra
Disallow: /blocked-for-ancstra/
    `;
    const checker = new RobotsChecker(mockFetch(robotsTxt));

    // Ancstra-specific rule applies
    expect(
      await checker.isAllowed('https://example.com/blocked-for-ancstra/page')
    ).toBe(false);

    // Ancstra agent doesn't inherit wildcard rules (it has its own block)
    expect(
      await checker.isAllowed('https://example.com/blocked-for-all/page')
    ).toBe(true);
  });

  it('respects Crawl-delay directive', async () => {
    const robotsTxt = `
User-agent: *
Crawl-delay: 5
Disallow: /private/
    `;
    const checker = new RobotsChecker(mockFetch(robotsTxt));

    const delay = await checker.getCrawlDelay('example.com');
    expect(delay).toBe(5);
  });

  it('returns undefined crawl delay when not set', async () => {
    const robotsTxt = `
User-agent: *
Disallow: /private/
    `;
    const checker = new RobotsChecker(mockFetch(robotsTxt));

    const delay = await checker.getCrawlDelay('example.com');
    expect(delay).toBeUndefined();
  });

  it('caches robots.txt per domain', async () => {
    const fetch = mockFetch(`
User-agent: *
Disallow: /no/
    `);
    const checker = new RobotsChecker(fetch);

    await checker.isAllowed('https://example.com/page1');
    await checker.isAllowed('https://example.com/page2');
    await checker.isAllowed('https://other.com/page1');

    // Should fetch once for example.com (cached) and once for other.com
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('allows everything when robots.txt is empty', async () => {
    const checker = new RobotsChecker(mockFetch(''));

    expect(await checker.isAllowed('https://example.com/anything')).toBe(true);
  });
});
