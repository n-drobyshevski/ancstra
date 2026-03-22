import { auth } from '@/auth';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const dbPath = process.env.DATABASE_URL || join(process.cwd(), '..', '..', 'packages', 'db', 'ancstra.db');

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
}
