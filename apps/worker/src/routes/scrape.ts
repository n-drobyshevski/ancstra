import { Hono } from 'hono';
import { z } from 'zod/v3';
import { scrapeUrlJob } from '../jobs/scrape-url';
import { scrapeBatchJob } from '../jobs/scrape-batch';

const scrapeUrlSchema = z.object({
  jobId: z.string(),
  itemId: z.string(),
  url: z.string().url('Invalid URL'),
  dbFilename: z.string().min(1, 'dbFilename required'),
  extractEntities: z.boolean().optional(),
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

  const { jobId, itemId, url, dbFilename, extractEntities } = parsed.data;

  // Fire-and-forget: run job in background
  scrapeUrlJob({ jobId, itemId, url, dbFilename, extractEntities }).catch((err) => {
    console.error(`Scrape job ${jobId} failed:`, err);
  });

  return c.json({ jobId, status: 'accepted' }, 202);
});

const scrapeBatchSchema = z.object({
  urls: z
    .array(z.string().url('Each URL must be valid'))
    .min(1, 'At least one URL required')
    .max(20, 'Maximum 20 URLs per batch'),
  extractEntities: z.boolean().optional(),
  personId: z.string().optional(),
  maxConcurrency: z.number().int().min(1).max(3).optional(),
});

scrape.post('/jobs/scrape-batch', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = scrapeBatchSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400
    );
  }

  const batchId = crypto.randomUUID();

  // Fire-and-forget: run batch in background
  scrapeBatchJob(parsed.data).catch((err) => {
    console.error(`Scrape batch ${batchId} failed:`, err);
  });

  return c.json(
    { batchId, status: 'accepted', urlCount: parsed.data.urls.length },
    202
  );
});

export { scrape };
