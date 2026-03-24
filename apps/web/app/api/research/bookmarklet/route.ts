import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  createResearchItem,
  getResearchItem,
  updateResearchItemContent,
} from '@ancstra/research';
import { researchItems } from '@ancstra/db';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { ctx, familyDb } = await withAuth('ai:research');

    const formData = await request.formData();
    const url = formData.get('url') as string | null;
    const text = formData.get('text') as string | null;
    const title = formData.get('title') as string | null;

    if (!text?.trim()) {
      return new Response(bookmarkletPage('No text received.', null), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const fullText = text.trim().slice(0, 50_000);
    const pageTitle = title?.trim() || (url ? new URL(url).hostname : 'Bookmarklet capture');
    const snippet = fullText.length > 300 ? fullText.slice(0, 297) + '...' : fullText;

    // Try to find existing item by URL
    let itemId: string | null = null;
    if (url) {
      const existing = await familyDb
        .select({ id: researchItems.id })
        .from(researchItems)
        .where(eq(researchItems.url, url))
        .all();
      if (existing[0]) {
        itemId = existing[0].id;
      }
    }

    if (itemId) {
      // Update existing item
      await updateResearchItemContent(familyDb, itemId, {
        title: pageTitle,
        snippet,
        fullText,
      });
    } else {
      // Create new item
      const item = await createResearchItem(familyDb, {
        title: pageTitle,
        url: url ?? undefined,
        snippet,
        fullText,
        discoveryMethod: 'scrape',
        createdBy: ctx.userId,
      });
      itemId = item.id;
    }

    const redirectUrl = `/research/item/${itemId}`;
    return new Response(bookmarkletPage('Text saved successfully!', redirectUrl), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/bookmarklet POST]', err);
    return new Response(bookmarkletPage('Error: not logged in or session expired. Open Ancstra first.', null), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function bookmarkletPage(message: string, redirectUrl: string | null): string {
  return `<!DOCTYPE html>
<html><head><title>Ancstra Bookmarklet</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; }
  .card { background: white; border-radius: 12px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
  .msg { font-size: 1.1rem; margin-bottom: 1rem; }
  a { color: #4f46e5; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head><body>
<div class="card">
  <p class="msg">${message}</p>
  ${redirectUrl ? `<p>Redirecting... <a href="${redirectUrl}">Click here</a> if not redirected.</p><script>setTimeout(()=>location.href="${redirectUrl}",1500)</script>` : '<p>You can close this tab.</p>'}
</div>
</body></html>`;
}
