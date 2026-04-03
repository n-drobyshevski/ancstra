import { tool } from 'ai';
import { z } from 'zod/v3';

interface ScrapeResult {
  title: string | null;
  textContent: string;
  metadata: Record<string, string | undefined>;
  jobId?: string;
  async?: boolean;
  error?: string;
}

/**
 * Create the scrapeUrl tool.
 * Dispatches to the scraper worker if available, otherwise does a lightweight fetch.
 */
export function createScrapeUrlTool(options?: {
  workerBaseUrl?: string;
}) {
  return tool({
    description: 'Scrape a URL to extract its text content and metadata for genealogy research',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to scrape'),
      extractEntities: z.boolean().default(false).describe('Whether to attempt entity extraction from the page content'),
    }),
    execute: async ({ url, extractEntities }) => {
      if (options?.workerBaseUrl) {
        try {
          const response = await fetch(`${options.workerBaseUrl}/jobs/scrape-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, extractEntities }),
          });

          if (!response.ok) {
            return {
              title: null,
              textContent: '',
              metadata: {},
              error: `Scraper worker returned status ${response.status}`,
            } satisfies ScrapeResult;
          }

          const data = await response.json() as { jobId: string; status: string };
          return {
            title: null,
            textContent: '',
            metadata: {},
            jobId: data.jobId,
            async: true,
            error: undefined,
          } satisfies ScrapeResult;
        } catch {
          // Worker unavailable — fall through to lightweight fetch
        }
      }

      // Lightweight fetch fallback (no Playwright)
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Ancstra/1.0 (genealogy research tool)',
            Accept: 'text/html',
          },
          signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) {
          return {
            title: null,
            textContent: '',
            metadata: {},
            error: `Fetch returned ${res.status}`,
          } satisfies ScrapeResult;
        }

        const html = await res.text();

        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch?.[1]?.trim() ?? null;

        const descMatch = html.match(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
        );
        const description = descMatch?.[1]?.trim();

        // Extract visible text (rough: strip tags)
        const textContent = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 10_000);

        return {
          title,
          textContent,
          metadata: {
            description,
          },
        } satisfies ScrapeResult;
      } catch (err) {
        return {
          title: null,
          textContent: '',
          metadata: {},
          error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        } satisfies ScrapeResult;
      }
    },
  });
}
