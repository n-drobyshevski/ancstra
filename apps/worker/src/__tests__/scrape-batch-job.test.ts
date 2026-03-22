import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockScrapeUrlJob = vi.fn();

vi.mock('../jobs/scrape-url', () => ({
  scrapeUrlJob: (...args: unknown[]) => mockScrapeUrlJob(...args),
}));

// Must import after mock setup
const { scrapeBatchJob } = await import('../jobs/scrape-batch');

describe('scrapeBatchJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScrapeUrlJob.mockResolvedValue(undefined);
  });

  it('processes multiple URLs successfully', async () => {
    const result = await scrapeBatchJob({
      urls: ['https://example.com/a', 'https://example.com/b'],
    });

    expect(result.totalProcessed).toBe(2);
    expect(result.totalSuccess).toBe(2);
    expect(result.totalErrors).toBe(0);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe('success');
    expect(result.results[1].status).toBe('success');
    expect(mockScrapeUrlJob).toHaveBeenCalledTimes(2);
  });

  it('isolates per-URL errors without failing batch', async () => {
    mockScrapeUrlJob
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce(undefined);

    const result = await scrapeBatchJob({
      urls: [
        'https://example.com/ok1',
        'https://example.com/fail',
        'https://example.com/ok2',
      ],
    });

    expect(result.totalProcessed).toBe(3);
    expect(result.totalSuccess).toBe(2);
    expect(result.totalErrors).toBe(1);

    const failedResult = result.results.find(
      (r) => r.url === 'https://example.com/fail'
    );
    expect(failedResult?.status).toBe('error');
    expect(failedResult?.error).toBe('Network timeout');
  });

  it('respects maxConcurrency', async () => {
    let concurrentCount = 0;
    let maxConcurrent = 0;

    mockScrapeUrlJob.mockImplementation(async () => {
      concurrentCount++;
      if (concurrentCount > maxConcurrent) {
        maxConcurrent = concurrentCount;
      }
      // Simulate some async work
      await new Promise((r) => setTimeout(r, 50));
      concurrentCount--;
    });

    await scrapeBatchJob({
      urls: [
        'https://example.com/1',
        'https://example.com/2',
        'https://example.com/3',
        'https://example.com/4',
      ],
      maxConcurrency: 2,
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(mockScrapeUrlJob).toHaveBeenCalledTimes(4);
  });

  it('reports progress via callback', async () => {
    const progressUpdates: Array<{
      completed: number;
      total: number;
      url: string;
      status: string;
    }> = [];

    await scrapeBatchJob({
      urls: ['https://example.com/a', 'https://example.com/b'],
      onProgress: (progress) => {
        progressUpdates.push(progress);
      },
    });

    expect(progressUpdates).toHaveLength(2);
    expect(progressUpdates[progressUpdates.length - 1].completed).toBe(2);
    expect(progressUpdates[progressUpdates.length - 1].total).toBe(2);
  });

  it('clamps maxConcurrency to valid range', async () => {
    // maxConcurrency > 3 should be clamped to 3
    let concurrentCount = 0;
    let maxConcurrent = 0;

    mockScrapeUrlJob.mockImplementation(async () => {
      concurrentCount++;
      if (concurrentCount > maxConcurrent) {
        maxConcurrent = concurrentCount;
      }
      await new Promise((r) => setTimeout(r, 30));
      concurrentCount--;
    });

    await scrapeBatchJob({
      urls: Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`),
      maxConcurrency: 10,
    });

    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('passes extractEntities and personId to each job', async () => {
    await scrapeBatchJob({
      urls: ['https://example.com/page'],
      extractEntities: true,
      personId: 'person-42',
    });

    expect(mockScrapeUrlJob).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/page',
        extractEntities: true,
        personId: 'person-42',
      })
    );
  });
});
