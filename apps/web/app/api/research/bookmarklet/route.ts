import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  createResearchItem,
  updateResearchItemContent,
} from '@ancstra/research';
import { researchItems } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'a', 'strong', 'em', 'b', 'i', 'u', 's', 'small', 'sub', 'sup',
  'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'dl', 'dt', 'dd',
  'figure', 'figcaption', 'img',
  'span', 'div', 'section', 'article',
  'details', 'summary', 'time', 'abbr', 'mark',
];

function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      '*': ['style', 'class'],
      a: ['href', 'title', 'target'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan', 'scope'],
      time: ['datetime'],
      abbr: ['title'],
    },
    allowedSchemes: ['http', 'https', 'data'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    // Strip dangerous CSS properties while keeping visual ones
    allowedStyles: {
      '*': {
        'color': [/.*/],
        'background-color': [/.*/],
        'background': [/^(?!.*url).*$/], // allow colors, block url()
        'font-size': [/.*/],
        'font-weight': [/.*/],
        'font-style': [/.*/],
        'font-family': [/.*/],
        'text-align': [/.*/],
        'text-decoration': [/.*/],
        'line-height': [/.*/],
        'margin': [/.*/],
        'margin-top': [/.*/],
        'margin-bottom': [/.*/],
        'margin-left': [/.*/],
        'margin-right': [/.*/],
        'padding': [/.*/],
        'padding-top': [/.*/],
        'padding-bottom': [/.*/],
        'padding-left': [/.*/],
        'padding-right': [/.*/],
        'border': [/.*/],
        'border-bottom': [/.*/],
        'border-top': [/.*/],
        'border-radius': [/.*/],
        'width': [/.*/],
        'max-width': [/.*/],
        'min-width': [/.*/],
        'height': [/.*/],
        'display': [/^(block|inline|inline-block|flex|grid|table|table-row|table-cell|list-item)$/],
        'float': [/.*/],
        'clear': [/.*/],
        'vertical-align': [/.*/],
        'white-space': [/.*/],
        'overflow': [/^(hidden|auto|scroll|visible)$/],
        'list-style': [/.*/],
        'list-style-type': [/.*/],
        'gap': [/.*/],
        'flex-direction': [/.*/],
        'align-items': [/.*/],
        'justify-content': [/.*/],
      },
    },
  }).trim();
}

function stripToPlainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(request: Request) {
  try {
    const { ctx, familyDb } = await withAuth('ai:research');

    const formData = await request.formData();
    const url = formData.get('url') as string | null;
    const rawHtml = formData.get('html') as string | null;
    const text = formData.get('text') as string | null;
    const title = formData.get('title') as string | null;

    const content = rawHtml?.trim() || text?.trim();
    if (!content) {
      return new Response(bookmarkletPage('No content received.', null), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Sanitize HTML content, or use plain text as-is
    const fullText = rawHtml
      ? sanitize(content).slice(0, 100_000)
      : content.slice(0, 50_000);

    const pageTitle = title?.trim() || (url ? new URL(url).hostname : 'Bookmarklet capture');
    const plainText = rawHtml ? stripToPlainText(content) : content;
    const snippet = plainText.length > 300 ? plainText.slice(0, 297) + '...' : plainText;

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
      await updateResearchItemContent(familyDb, itemId, {
        title: pageTitle,
        snippet,
        fullText,
      });
    } else {
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
    return new Response(bookmarkletPage('Content saved!', redirectUrl), {
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
