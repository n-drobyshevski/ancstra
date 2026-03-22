import type { Page } from 'playwright';
import type { ScrapeOptions, ScrapeResult, PageMetadata } from './types';

/**
 * Scrapes a URL using a Playwright page, extracting title, text content,
 * HTML, and metadata.
 */
export async function scrapeUrl(
  page: Page,
  options: ScrapeOptions
): Promise<ScrapeResult> {
  const timeout = options.timeout ?? 30_000;

  page.setDefaultTimeout(timeout);

  await page.goto(options.url, {
    waitUntil: 'networkidle',
    timeout,
  });

  if (options.waitForSelector) {
    await page.waitForSelector(options.waitForSelector, { timeout });
  }

  const title = await page.title();
  const finalUrl = page.url();

  const textContent = await page.evaluate(() => {
    // Remove script, style, nav, footer elements before extracting text
    const clone = document.body.cloneNode(true) as HTMLElement;
    const removeTags = ['script', 'style', 'nav', 'footer', 'noscript'];
    for (const tag of removeTags) {
      const elements = clone.querySelectorAll(tag);
      elements.forEach((el) => el.remove());
    }
    return clone.innerText?.trim() ?? '';
  });

  const html = await page.content();

  const metadata = await page.evaluate((): PageMetadata => {
    const getMeta = (name: string): string | undefined => {
      const el =
        document.querySelector(`meta[property="${name}"]`) ||
        document.querySelector(`meta[name="${name}"]`);
      return el?.getAttribute('content') || undefined;
    };

    const canonical =
      document
        .querySelector('link[rel="canonical"]')
        ?.getAttribute('href') || undefined;

    return {
      ogTitle: getMeta('og:title'),
      ogDescription: getMeta('og:description'),
      ogImage: getMeta('og:image'),
      ogSiteName: getMeta('og:site_name'),
      author: getMeta('author'),
      publishedTime: getMeta('article:published_time'),
      canonical,
    };
  });

  return {
    url: options.url,
    finalUrl,
    title,
    textContent,
    html,
    metadata,
    scrapedAt: new Date(),
  };
}
