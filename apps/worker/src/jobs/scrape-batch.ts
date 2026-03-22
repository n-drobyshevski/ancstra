import { scrapeUrlJob } from './scrape-url';

export interface ScrapeBatchInput {
  urls: string[];
  extractEntities?: boolean;
  personId?: string;
  maxConcurrency?: number;
  onProgress?: (progress: ScrapeBatchProgress) => void;
}

export interface ScrapeBatchProgress {
  completed: number;
  total: number;
  url: string;
  status: 'success' | 'error';
}

export interface ScrapeBatchUrlResult {
  url: string;
  status: 'success' | 'error';
  result?: { jobId: string };
  error?: string;
}

export interface ScrapeBatchResult {
  results: ScrapeBatchUrlResult[];
  totalProcessed: number;
  totalSuccess: number;
  totalErrors: number;
}

const MAX_URLS = 20;
const MAX_CONCURRENCY = 3;
const DEFAULT_CONCURRENCY = 1;

/**
 * Scrape multiple URLs with concurrency control.
 * Each URL runs the full pipeline (scrape -> screenshot -> archive).
 * Failures are captured per-URL; the batch continues on individual errors.
 */
export async function scrapeBatchJob(
  input: ScrapeBatchInput
): Promise<ScrapeBatchResult> {
  const { default: pLimit } = await import('p-limit');

  const concurrency = Math.min(
    Math.max(input.maxConcurrency ?? DEFAULT_CONCURRENCY, 1),
    MAX_CONCURRENCY
  );

  const urls = input.urls.slice(0, MAX_URLS);
  const limit = pLimit(concurrency);
  const results: ScrapeBatchUrlResult[] = [];
  let completed = 0;

  const tasks = urls.map((url) =>
    limit(async () => {
      const jobId = crypto.randomUUID();
      try {
        await scrapeUrlJob({
          jobId,
          url,
          extractEntities: input.extractEntities,
          personId: input.personId,
        });

        const result: ScrapeBatchUrlResult = {
          url,
          status: 'success',
          result: { jobId },
        };
        results.push(result);
        completed++;

        input.onProgress?.({
          completed,
          total: urls.length,
          url,
          status: 'success',
        });

        return result;
      } catch (err) {
        const error =
          err instanceof Error ? err.message : 'Unknown error';

        const result: ScrapeBatchUrlResult = {
          url,
          status: 'error',
          error,
        };
        results.push(result);
        completed++;

        input.onProgress?.({
          completed,
          total: urls.length,
          url,
          status: 'error',
        });

        return result;
      }
    })
  );

  await Promise.all(tasks);

  const totalSuccess = results.filter((r) => r.status === 'success').length;
  const totalErrors = results.filter((r) => r.status === 'error').length;

  return {
    results,
    totalProcessed: results.length,
    totalSuccess,
    totalErrors,
  };
}
