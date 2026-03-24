import { withPage } from '../lib/playwright';
import { scrapeUrl, captureScreenshot, archiveScrapeResult, updateScrapeJob, updateResearchItemContent } from '@ancstra/research';
import { createFamilyDb } from '@ancstra/db';
import path from 'node:path';

export interface ScrapeUrlJobInput {
  jobId: string;
  itemId?: string;
  url: string;
  dbFilename?: string;
  extractEntities?: boolean;
  /** @deprecated No longer used; kept for batch-job backwards compat */
  personId?: string;
}

const ARCHIVE_PATH =
  process.env.SCRAPE_ARCHIVE_PATH ||
  path.join(process.cwd(), 'data', 'scrape-archive');

/**
 * Scrape a single URL: extract content, capture screenshot, archive results,
 * and persist the outcome to the family DB transactionally.
 */
export async function scrapeUrlJob(input: ScrapeUrlJobInput): Promise<void> {
  console.log(`[scrape-url] Starting job ${input.jobId} for ${input.url}`);

  const db = input.dbFilename ? createFamilyDb(input.dbFilename) : null;

  if (db) {
    await updateScrapeJob(db, input.jobId, { status: 'processing' });
  }

  try {
    await withPage(
      async (page) => {
        const result = await scrapeUrl(page, {
          url: input.url,
          extractEntities: input.extractEntities,
        });

        const screenshot = await captureScreenshot(page);

        const archive = await archiveScrapeResult(
          result,
          screenshot,
          ARCHIVE_PATH
        );

        if (db && input.itemId) {
          await (db as any).transaction(async (tx: any) => {
            await updateScrapeJob(tx, input.jobId, {
              status: 'completed',
              title: result.title,
              snippet: result.metadata.ogDescription,
              fullText: result.textContent,
              method: 'playwright',
              completedAt: new Date().toISOString(),
            });
            await updateResearchItemContent(tx, input.itemId as string, {
              title: result.title,
              snippet: result.metadata.ogDescription,
              fullText: result.textContent,
            });
          });
        }

        console.log(
          `[scrape-url] Job ${input.jobId} complete. Title: "${result.title}". Archived to: ${archive.htmlPath}`
        );
      },
      { timeout: 30_000 }
    );
  } catch (err) {
    if (db) {
      await updateScrapeJob(db, input.jobId, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date().toISOString(),
      });
    }
    console.error(`[scrape-url] Job ${input.jobId} failed:`, err);
  }
}
