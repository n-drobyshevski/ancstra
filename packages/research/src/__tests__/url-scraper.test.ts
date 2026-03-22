import { describe, it, expect, vi } from 'vitest';
import { scrapeUrl } from '../scraper/url-scraper';

function createMockPage(overrides: Record<string, unknown> = {}) {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    title: vi.fn().mockResolvedValue('Test Title'),
    content: vi.fn().mockResolvedValue('<html><body>Hello</body></html>'),
    evaluate: vi.fn(),
    url: vi.fn().mockReturnValue('https://example.com/final'),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('png')),
    close: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    setDefaultTimeout: vi.fn(),
    ...overrides,
  };
}

describe('scrapeUrl', () => {
  it('extracts title, text, html, metadata, and finalUrl', async () => {
    const mockPage = createMockPage();

    // First evaluate call returns textContent, second returns metadata
    mockPage.evaluate
      .mockResolvedValueOnce('Hello World body text')
      .mockResolvedValueOnce({
        ogTitle: 'OG Title',
        ogDescription: 'A description',
        ogImage: 'https://example.com/image.png',
        ogSiteName: 'Example',
        author: 'John Doe',
        publishedTime: '2024-01-01',
        canonical: 'https://example.com/canonical',
      });

    const result = await scrapeUrl(mockPage as any, {
      url: 'https://example.com/page',
    });

    expect(result.url).toBe('https://example.com/page');
    expect(result.finalUrl).toBe('https://example.com/final');
    expect(result.title).toBe('Test Title');
    expect(result.textContent).toBe('Hello World body text');
    expect(result.html).toBe('<html><body>Hello</body></html>');
    expect(result.metadata.ogTitle).toBe('OG Title');
    expect(result.metadata.ogDescription).toBe('A description');
    expect(result.metadata.author).toBe('John Doe');
    expect(result.metadata.canonical).toBe('https://example.com/canonical');
    expect(result.scrapedAt).toBeInstanceOf(Date);

    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/page', {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });
    expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(30_000);
  });

  it('waits for selector when provided', async () => {
    const mockPage = createMockPage();
    mockPage.evaluate
      .mockResolvedValueOnce('text')
      .mockResolvedValueOnce({});

    await scrapeUrl(mockPage as any, {
      url: 'https://example.com',
      waitForSelector: '#content',
    });

    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#content', {
      timeout: 30_000,
    });
  });

  it('uses custom timeout', async () => {
    const mockPage = createMockPage();
    mockPage.evaluate
      .mockResolvedValueOnce('text')
      .mockResolvedValueOnce({});

    await scrapeUrl(mockPage as any, {
      url: 'https://example.com',
      timeout: 10_000,
    });

    expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(10_000);
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
      waitUntil: 'networkidle',
      timeout: 10_000,
    });
  });

  it('handles empty metadata gracefully', async () => {
    const mockPage = createMockPage();
    mockPage.evaluate
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce({
        ogTitle: undefined,
        ogDescription: undefined,
        ogImage: undefined,
        ogSiteName: undefined,
        author: undefined,
        publishedTime: undefined,
        canonical: undefined,
      });

    const result = await scrapeUrl(mockPage as any, {
      url: 'https://example.com',
    });

    expect(result.textContent).toBe('');
    expect(result.metadata.ogTitle).toBeUndefined();
  });
});
