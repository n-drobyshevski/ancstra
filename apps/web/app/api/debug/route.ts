import { NextResponse } from 'next/server';
import { createCentralDb, centralSchema } from '@ancstra/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    results.dbConfigured = !!process.env.CENTRAL_DATABASE_URL;

    const db = createCentralDb();

    const tables = await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
    results.tables = (tables as any[]).map((t: any) => t.name);

    const users = await db.select().from(centralSchema.users).all();
    results.userCount = users.length;

    results.status = 'ok';
  } catch (error: any) {
    results.status = 'error';
    results.error = error.message;
    results.cause = error.cause?.message;
  }

  return NextResponse.json(results);
}
