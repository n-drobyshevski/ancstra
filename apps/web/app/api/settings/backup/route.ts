import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function POST() {
  try {
    const { ctx } = await withAuth('settings:manage');

    const dbPath = process.env.DATABASE_URL || join(process.cwd(), '..', '..', 'packages', 'db', 'data', ctx.dbFilename);

    try {
      const data = await readFile(dbPath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="ancstra-backup-${timestamp}.db"`,
          'Content-Length': String(data.length),
        },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Database file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return handleAuthError(error);
  }
}
