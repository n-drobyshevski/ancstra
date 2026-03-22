import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
import { createResearchItem } from '@ancstra/research';
import { z } from 'zod';

const requestSchema = z.object({
  url: z.string().url('Invalid URL'),
  extractEntities: z.boolean().optional(),
  personId: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { url } = parsed.data;

  // Validate protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return NextResponse.json(
      { error: 'URL must start with http:// or https://' },
      { status: 400 }
    );
  }

  try {
    // Simple fetch to extract title from HTML
    // TODO: Dispatch to Hono worker for full Playwright scrape when worker is running
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Ancstra/1.0 (genealogy research tool)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15_000),
    });

    let title = new URL(url).hostname;
    let snippet: string | undefined;

    if (pageRes.ok) {
      const html = await pageRes.text();

      // Extract <title> from HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch?.[1]) {
        title = titleMatch[1].trim();
      }

      // Extract meta description for snippet
      const descMatch = html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
      );
      if (descMatch?.[1]) {
        snippet = descMatch[1].trim().slice(0, 500);
      }
    }

    const db = createDb();
    const item = createResearchItem(db, {
      title,
      url,
      snippet,
      discoveryMethod: 'paste_url',
      createdBy: session.user.id!,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[research/scrape POST]', err);

    // Even if fetch fails, still save the URL as a research item
    try {
      const db = createDb();
      const item = createResearchItem(db, {
        title: new URL(url).hostname,
        url,
        discoveryMethod: 'paste_url',
        createdBy: session.user.id!,
      });
      return NextResponse.json(item, { status: 201 });
    } catch (dbErr) {
      console.error('[research/scrape POST] DB fallback failed:', dbErr);
      return NextResponse.json({ error: 'Failed to save URL' }, { status: 500 });
    }
  }
}
