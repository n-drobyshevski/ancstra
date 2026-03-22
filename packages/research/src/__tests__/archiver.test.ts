import { describe, it, expect, afterEach } from 'vitest';
import { archiveScrapeResult } from '../scraper/archiver';
import type { ScrapeResult } from '../scraper/types';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

describe('archiveScrapeResult', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function makeTmpDir() {
    tmpDir = path.join(
      os.tmpdir(),
      `ancstra-archiver-test-${crypto.randomUUID()}`
    );
    return tmpDir;
  }

  function makeScrapeResult(overrides: Partial<ScrapeResult> = {}): ScrapeResult {
    return {
      url: 'https://example.com/page',
      finalUrl: 'https://example.com/page',
      title: 'Test Page',
      textContent: 'Hello World',
      html: '<html><body>Hello World</body></html>',
      metadata: {},
      scrapedAt: new Date('2025-06-15T12:00:00Z'),
      ...overrides,
    };
  }

  it('saves HTML and PNG files to correct directory structure', async () => {
    const archivePath = makeTmpDir();
    const result = makeScrapeResult();
    const screenshot = Buffer.from('fake-png-data');

    const archive = await archiveScrapeResult(result, screenshot, archivePath);

    // Check directory structure: {archivePath}/2025/06/{hash}.html
    expect(archive.htmlPath).toContain(path.join('2025', '06'));
    expect(archive.screenshotPath).toContain(path.join('2025', '06'));
    expect(archive.htmlPath).toMatch(/\.html$/);
    expect(archive.screenshotPath).toMatch(/\.png$/);

    // Verify files exist
    expect(fs.existsSync(archive.htmlPath)).toBe(true);
    expect(fs.existsSync(archive.screenshotPath)).toBe(true);

    // Verify content
    const savedHtml = fs.readFileSync(archive.htmlPath, 'utf-8');
    expect(savedHtml).toBe('<html><body>Hello World</body></html>');

    const savedPng = fs.readFileSync(archive.screenshotPath);
    expect(savedPng.toString()).toBe('fake-png-data');

    expect(archive.archivedAt).toBeInstanceOf(Date);
  });

  it('uses SHA-256 hash of URL for filename', async () => {
    const archivePath = makeTmpDir();
    const url = 'https://example.com/page';
    const expectedHash = crypto.createHash('sha256').update(url).digest('hex');

    const result = makeScrapeResult({ url });
    const archive = await archiveScrapeResult(
      result,
      Buffer.from('png'),
      archivePath
    );

    expect(path.basename(archive.htmlPath, '.html')).toBe(expectedHash);
    expect(path.basename(archive.screenshotPath, '.png')).toBe(expectedHash);
  });

  it('creates nested directories if they do not exist', async () => {
    const archivePath = makeTmpDir();
    // archivePath doesn't exist yet
    expect(fs.existsSync(archivePath)).toBe(false);

    const result = makeScrapeResult();
    const archive = await archiveScrapeResult(
      result,
      Buffer.from('png'),
      archivePath
    );

    expect(fs.existsSync(path.dirname(archive.htmlPath))).toBe(true);
  });
});
