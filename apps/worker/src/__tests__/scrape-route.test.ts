import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock jobs so they don't actually launch Playwright
vi.mock('../jobs/scrape-url', () => ({
  scrapeUrlJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../jobs/scrape-batch', () => ({
  scrapeBatchJob: vi.fn().mockResolvedValue({
    results: [],
    totalProcessed: 0,
    totalSuccess: 0,
    totalErrors: 0,
  }),
}));

import { scrape } from '../routes/scrape';

describe('POST /jobs/scrape-url', () => {
  const app = new Hono();
  app.route('/', scrape);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 202 for a valid URL', async () => {
    const res = await app.request('/jobs/scrape-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/page' }),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe('accepted');
    expect(body.jobId).toBeDefined();
    expect(typeof body.jobId).toBe('string');
  });

  it('returns 202 with optional fields', async () => {
    const res = await app.request('/jobs/scrape-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/page',
        extractEntities: true,
        personId: 'person-123',
      }),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe('accepted');
  });

  it('returns 400 for missing URL', async () => {
    const res = await app.request('/jobs/scrape-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid URL', async () => {
    const res = await app.request('/jobs/scrape-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await app.request('/jobs/scrape-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    expect(res.status).toBe(400);
  });
});

describe('POST /jobs/scrape-batch', () => {
  const app = new Hono();
  app.route('/', scrape);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 202 for valid batch of URLs', async () => {
    const res = await app.request('/jobs/scrape-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: ['https://example.com/a', 'https://example.com/b'],
      }),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe('accepted');
    expect(body.batchId).toBeDefined();
    expect(body.urlCount).toBe(2);
  });

  it('returns 400 for empty urls array', async () => {
    const res = await app.request('/jobs/scrape-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [] }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for more than 20 URLs', async () => {
    const urls = Array.from(
      { length: 21 },
      (_, i) => `https://example.com/${i}`
    );

    const res = await app.request('/jobs/scrape-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid URLs in array', async () => {
    const res = await app.request('/jobs/scrape-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: ['not-a-url'] }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await app.request('/jobs/scrape-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    expect(res.status).toBe(400);
  });
});
