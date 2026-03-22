import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock the scrape-url job so it doesn't actually launch Playwright
vi.mock('../jobs/scrape-url', () => ({
  scrapeUrlJob: vi.fn().mockResolvedValue(undefined),
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

  it('returns 501 not implemented', async () => {
    const res = await app.request('/jobs/scrape-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(501);
  });
});
