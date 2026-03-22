import { withPage } from '../lib/playwright';
import { scrapeUrl, captureScreenshot, archiveScrapeResult } from '@ancstra/research';
import path from 'node:path';

export interface ScrapeUrlJobInput {
  jobId: string;
  url: string;
  extractEntities?: boolean;
  personId?: string;
}

const ARCHIVE_PATH =
  process.env.SCRAPE_ARCHIVE_PATH ||
  path.join(process.cwd(), 'data', 'scrape-archive');

/**
 * Scrape a single URL: extract content, capture screenshot, archive results.
 */
export async function scrapeUrlJob(input: ScrapeUrlJobInput): Promise<void> {
  console.log(`[scrape-url] Starting job ${input.jobId} for ${input.url}`);

  await withPage(
    async (page) => {
      const result = await scrapeUrl(page, {
        url: input.url,
        extractEntities: input.extractEntities,
        personId: input.personId,
      });

      const screenshot = await captureScreenshot(page);

      const archive = await archiveScrapeResult(
        result,
        screenshot,
        ARCHIVE_PATH
      );

      console.log(
        `[scrape-url] Job ${input.jobId} complete. Title: "${result.title}". Archived to: ${archive.htmlPath}`
      );
    },
    { timeout: 30_000 }
  );
}
