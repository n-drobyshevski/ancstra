import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { createResearchItem, getResearchItem, updateResearchItemContent, createScrapeJob, findActiveScrapeJob } from '@ancstra/research';
import { z } from 'zod/v3';

const requestSchema = z.object({
  url: z.string().url('Invalid URL'),
  itemId: z.string().optional(),
  extractEntities: z.boolean().optional(),
  personId: z.string().optional(),
});

async function fetchPageContent(url: string): Promise<{ title: string; snippet?: string; fullText?: string }> {
  const pageRes = await fetch(url, {
    headers: {
      'User-Agent': 'Ancstra/1.0 (genealogy research tool)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(15_000),
  });

  let title = new URL(url).hostname;
  let snippet: string | undefined;
  let fullText: string | undefined;

  if (pageRes.ok) {
    const html = await pageRes.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      title = titleMatch[1].trim();
    }

    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
    );
    if (descMatch?.[1]) {
      snippet = descMatch[1].trim().slice(0, 500);
    }

    // Extract text content by stripping tags
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch?.[1]) {
      const body = bodyMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      if (body.length > 50) {
        fullText = body.slice(0, 50_000);
      }
    }
  }

  return { title, snippet, fullText };
}

export async function POST(request: Request) {
  try {
    const { ctx, familyDb } = await withAuth('ai:research');

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { url, itemId, extractEntities } = parsed.data;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'URL must start with http:// or https://' },
        { status: 400 },
      );
    }

    // If itemId provided, verify it exists
    if (itemId) {
      const existing = await getResearchItem(familyDb, itemId);
      if (!existing) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
    }

    // Dispatch to worker for full Playwright scrape if available
    const workerUrl = process.env['WORKER_URL'];
    if (workerUrl && itemId) {
      // Duplicate guard: check for existing active job
      const existingJob = await findActiveScrapeJob(familyDb, itemId);
      if (existingJob) {
        return NextResponse.json({
          jobId: existingJob.id,
          itemId,
          status: existingJob.status,
        });
      }

      try {
        const jobId = crypto.randomUUID();

        // Create job row BEFORE dispatching to worker
        await createScrapeJob(familyDb, {
          id: jobId,
          itemId,
          url,
          method: 'playwright',
        });

        const workerRes = await fetch(`${workerUrl}/jobs/scrape-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            itemId,
            url,
            dbFilename: ctx.dbFilename,
            extractEntities,
          }),
          signal: AbortSignal.timeout(5_000),
        });

        if (workerRes.ok) {
          return NextResponse.json({ jobId, itemId, status: 'pending' });
        }

        // Worker rejected — clean up and fall through
      } catch {
        // Worker unavailable — fall through to fetch-based extraction
      }
    }

    // Fallback: simple fetch extraction
    try {
      const { title, snippet, fullText } = await fetchPageContent(url);

      if (itemId) {
        // Update existing item with scraped content
        await updateResearchItemContent(familyDb, itemId, { title, snippet, fullText });
        const updated = await getResearchItem(familyDb, itemId);
        return NextResponse.json({ itemId, status: 'completed', fullText: updated?.fullText ?? null });
      }

      const item = await createResearchItem(familyDb, {
        title,
        url,
        snippet,
        fullText,
        discoveryMethod: 'paste_url',
        createdBy: ctx.userId,
      });

      return NextResponse.json(item, { status: 201 });
    } catch {
      // Even if fetch fails, still save the URL (only for new items)
      if (itemId) {
        return NextResponse.json({ itemId, status: 'failed', error: 'Failed to scrape URL' }, { status: 502 });
      }
      try {
        const item = await createResearchItem(familyDb, {
          title: new URL(url).hostname,
          url,
          discoveryMethod: 'paste_url',
          createdBy: ctx.userId,
        });
        return NextResponse.json(item, { status: 201 });
      } catch (dbErr) {
        console.error('[research/scrape POST] DB fallback failed:', dbErr);
        return NextResponse.json({ error: 'Failed to save URL' }, { status: 500 });
      }
    }
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/scrape POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
