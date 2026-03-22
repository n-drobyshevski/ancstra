import { Hono } from 'hono';
import { z } from 'zod';
import { scrapeUrlJob } from '../jobs/scrape-url';

const scrapeUrlSchema = z.object({
  url: z.string().url('Invalid URL'),
  extractEntities: z.boolean().optional(),
  personId: z.string().optional(),
});

const scrape = new Hono();

scrape.post('/jobs/scrape-url', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = scrapeUrlSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400
    );
  }

  const jobId = crypto.randomUUID();

  // Fire-and-forget: run job in background
  scrapeUrlJob({ jobId, ...parsed.data }).catch((err) => {
    console.error(`Scrape job ${jobId} failed:`, err);
  });

  return c.json({ jobId, status: 'accepted' }, 202);
});

scrape.post('/jobs/scrape-batch', (c) => {
  return c.json({ error: 'Not implemented' }, 501);
});

export { scrape };
