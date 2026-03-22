import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function getFileSize(filePath: string): Promise<number> {
  try {
    const s = await stat(filePath);
    return s.size;
  } catch {
    return 0;
  }
}

async function getDirSize(dirPath: string): Promise<number> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isFile()) {
        total += await getFileSize(fullPath);
      } else if (entry.isDirectory()) {
        total += await getDirSize(fullPath);
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const { ctx } = await withAuth('settings:manage');

    const dbPath = process.env.DATABASE_URL || join(process.cwd(), '..', '..', 'packages', 'db', 'data', ctx.dbFilename);
    const archivePath = process.env.ARCHIVE_PATH || join(process.cwd(), 'data', 'archives');
    const screenshotPath = process.env.SCREENSHOT_PATH || join(process.cwd(), 'data', 'screenshots');

    const [database, archives, screenshots] = await Promise.all([
      getFileSize(dbPath),
      getDirSize(archivePath),
      getDirSize(screenshotPath),
    ]);

    return NextResponse.json({
      database,
      archives,
      screenshots,
      total: database + archives + screenshots,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
