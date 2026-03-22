import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ScrapeResult, ArchiveResult } from './types';

/**
 * Archives a scrape result and screenshot to disk.
 *
 * Directory structure: {archivePath}/{YYYY}/{MM}/{hash}.html + {hash}.png
 * Hash is SHA-256 of the original URL.
 */
export async function archiveScrapeResult(
  result: ScrapeResult,
  screenshotBuffer: Buffer,
  archivePath: string
): Promise<ArchiveResult> {
  const hash = createHash('sha256').update(result.url).digest('hex');

  const date = result.scrapedAt;
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');

  const dir = path.join(archivePath, yyyy, mm);
  await mkdir(dir, { recursive: true });

  const htmlPath = path.join(dir, `${hash}.html`);
  const screenshotPath = path.join(dir, `${hash}.png`);

  await Promise.all([
    writeFile(htmlPath, result.html, 'utf-8'),
    writeFile(screenshotPath, screenshotBuffer),
  ]);

  return {
    htmlPath,
    screenshotPath,
    archivedAt: new Date(),
  };
}
