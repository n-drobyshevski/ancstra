import { chromium, type Browser, type Page } from 'playwright';

let browser: Browser | null = null;

/**
 * Lazy-launches a Chromium browser instance (headless) and reuses it.
 */
export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    });
  }
  return browser;
}

/**
 * Gracefully closes the browser instance if open.
 */
export async function closeBrowser(): Promise<void> {
  if (browser && browser.isConnected()) {
    await browser.close();
    browser = null;
  }
}

/**
 * Acquires a page, runs the provided function, and ensures the page
 * is closed in the finally block.
 */
export async function withPage<T>(
  fn: (page: Page) => Promise<T>,
  options?: { timeout?: number }
): Promise<T> {
  const b = await getBrowser();
  const page = await b.newPage();

  if (options?.timeout) {
    page.setDefaultTimeout(options.timeout);
  }

  try {
    return await fn(page);
  } finally {
    await page.close();
  }
}

// Graceful shutdown on SIGTERM
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  await closeBrowser();
  process.exit(0);
});
