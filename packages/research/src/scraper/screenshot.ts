import type { Page } from 'playwright';
import sharp from 'sharp';
import type { ScreenshotOptions } from './types';

/**
 * Captures a screenshot of the current page and optionally resizes it.
 * Returns a PNG buffer.
 */
export async function captureScreenshot(
  page: Page,
  options?: ScreenshotOptions
): Promise<Buffer> {
  const fullPage = options?.fullPage ?? false;
  const maxWidth = options?.maxWidth ?? 1280;

  const rawBuffer = await page.screenshot({
    type: 'png',
    fullPage,
  });

  // Resize if wider than maxWidth
  const image = sharp(rawBuffer);
  const meta = await image.metadata();

  if (meta.width && meta.width > maxWidth) {
    const resized = await image
      .resize({ width: maxWidth, withoutEnlargement: true })
      .png()
      .toBuffer();
    return resized;
  }

  return Buffer.from(rawBuffer);
}
