import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, researchItems } from '@ancstra/db';
import { isNotNull, or, sql } from 'drizzle-orm';
import { readdir, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function clearDirectory(dirPath: string): Promise<number> {
  let freed = 0;
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = join(dirPath, entry.name);
        const s = await stat(filePath);
        freed += s.size;
        await unlink(filePath);
      }
    }
  } catch {
    // Directory may not exist
  }
  return freed;
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const archivePath = process.env.ARCHIVE_PATH || join(process.cwd(), 'data', 'archives');
  const screenshotPath = process.env.SCREENSHOT_PATH || join(process.cwd(), 'data', 'screenshots');

  // Clear archive and screenshot files
  const [archiveFreed, screenshotFreed] = await Promise.all([
    clearDirectory(archivePath),
    clearDirectory(screenshotPath),
  ]);

  // Null out paths in research_items
  const db = createDb();
  db.update(researchItems)
    .set({
      archivedHtmlPath: null,
      screenshotPath: null,
      archivedAt: null,
    })
    .where(
      or(
        isNotNull(researchItems.archivedHtmlPath),
        isNotNull(researchItems.screenshotPath),
      )
    )
    .run();

  return NextResponse.json({ freedBytes: archiveFreed + screenshotFreed });
}
