const USER_AGENT = 'Ancstra';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface RobotsEntry {
  disallowedPaths: string[];
  crawlDelay?: number;
}

interface CacheEntry {
  rules: Map<string, RobotsEntry>;
  fetchedAt: number;
}

/**
 * Parse a robots.txt body into a map of user-agent -> rules.
 */
function parseRobotsTxt(body: string): Map<string, RobotsEntry> {
  const rules = new Map<string, RobotsEntry>();
  let currentAgents: string[] = [];

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();

    // Skip comments and empty lines
    if (!line || line.startsWith('#')) {
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const directive = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (directive === 'user-agent') {
      // If we encounter a new user-agent block after directives, reset
      const agent = value.toLowerCase();
      // Check if we're starting a fresh block
      if (currentAgents.length > 0) {
        const lastAgent = currentAgents[currentAgents.length - 1];
        const existing = rules.get(lastAgent);
        if (
          existing &&
          existing.disallowedPaths.length === 0 &&
          existing.crawlDelay === undefined
        ) {
          // Still collecting agents for same block
          currentAgents.push(agent);
          rules.set(agent, { disallowedPaths: [] });
          continue;
        }
        // New block
        currentAgents = [agent];
      } else {
        currentAgents = [agent];
      }
      if (!rules.has(agent)) {
        rules.set(agent, { disallowedPaths: [] });
      }
    } else if (directive === 'disallow' && value) {
      for (const agent of currentAgents) {
        const entry = rules.get(agent);
        if (entry) {
          entry.disallowedPaths.push(value);
        }
      }
    } else if (directive === 'crawl-delay') {
      const delay = parseFloat(value);
      if (!isNaN(delay) && delay > 0) {
        for (const agent of currentAgents) {
          const entry = rules.get(agent);
          if (entry) {
            entry.crawlDelay = delay;
          }
        }
      }
    }
  }

  return rules;
}

/**
 * Extract domain from a URL string.
 */
function getDomain(url: string): string {
  const parsed = new URL(url);
  return parsed.hostname;
}

/**
 * Get the origin (scheme + host) from a URL.
 */
function getOrigin(url: string): string {
  const parsed = new URL(url);
  return parsed.origin;
}

/**
 * Get the pathname from a URL.
 */
function getPath(url: string): string {
  const parsed = new URL(url);
  return parsed.pathname;
}

/**
 * Checks robots.txt rules for URLs before scraping.
 * Caches parsed robots.txt per domain with a 1-hour TTL.
 */
export class RobotsChecker {
  private cache = new Map<string, CacheEntry>();
  private fetchFn: typeof globalThis.fetch;

  constructor(fetchFn?: typeof globalThis.fetch) {
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  /**
   * Check whether a URL is allowed to be crawled by Ancstra.
   * Checks the 'Ancstra' user-agent first, then falls back to '*'.
   * Defaults to allowed on fetch failure.
   */
  async isAllowed(url: string): Promise<boolean> {
    const domain = getDomain(url);
    const path = getPath(url);
    const rules = await this.fetchRules(domain, getOrigin(url));

    if (!rules) return true;

    // Check specific user agent first, then wildcard
    const entry =
      rules.get(USER_AGENT.toLowerCase()) ?? rules.get('*');

    if (!entry) return true;

    return !entry.disallowedPaths.some((disallowed) =>
      path.startsWith(disallowed)
    );
  }

  /**
   * Get the Crawl-delay for a domain (in seconds), if set.
   * Checks 'Ancstra' user-agent first, then '*'.
   */
  async getCrawlDelay(domain: string): Promise<number | undefined> {
    const origin = `https://${domain}`;
    const rules = await this.fetchRules(domain, origin);

    if (!rules) return undefined;

    const entry =
      rules.get(USER_AGENT.toLowerCase()) ?? rules.get('*');

    return entry?.crawlDelay;
  }

  private async fetchRules(
    domain: string,
    origin: string
  ): Promise<Map<string, RobotsEntry> | null> {
    const cached = this.cache.get(domain);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.rules;
    }

    try {
      const response = await this.fetchFn(`${origin}/robots.txt`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        // No robots.txt or error -> allow everything
        return null;
      }

      const body = await response.text();
      const rules = parseRobotsTxt(body);

      this.cache.set(domain, { rules, fetchedAt: Date.now() });
      return rules;
    } catch {
      // Fetch failed -> default to allowed
      return null;
    }
  }
}
