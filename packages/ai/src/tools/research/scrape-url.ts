import { tool } from 'ai';
import { z } from 'zod';

interface ScrapeResult {
  title: string | null;
  textContent: string;
  metadata: Record<string, string | undefined>;
  error?: string;
}

/**
 * Create the scrapeUrl tool.
 * Dispatches to the scraper worker or uses @ancstra/research scrapeUrl directly.
 */
export function createScrapeUrlTool(options?: {
  workerBaseUrl?: string;
}) {
  return tool({
    description: 'Scrape a URL to extract its text content and metadata for genealogy research',
    parameters: z.object({
      url: z.string().url().describe('The URL to scrape'),
      extractEntities: z.boolean().default(false).describe('Whether to attempt entity extraction from the page content'),
    }),
    execute: async ({ url, extractEntities }) => {
      if (options?.workerBaseUrl) {
        // Dispatch to Hono worker
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

          return await response.json() as ScrapeResult;
        } catch (err) {
          return {
            title: null,
            textContent: '',
            metadata: {},
            error: `Scraper worker unavailable: ${err instanceof Error ? err.message : String(err)}`,
          } satisfies ScrapeResult;
        }
      }

      // No worker configured — return guidance
      return {
        title: null,
        textContent: '',
        metadata: {},
        error: 'URL scraping requires the scraper worker to be running. Start it with the research worker service.',
      } satisfies ScrapeResult;
    },
  });
}
