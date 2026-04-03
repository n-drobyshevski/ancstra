import { NextResponse } from 'next/server';
import { createCentralDb, centralSchema } from '@ancstra/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    const db = createCentralDb();

    const users = await db.select().from(centralSchema.users).all();
    results.userCount = users.length;
    results.users = users.map(u => ({ id: u.id.substring(0, 8), email: u.email }));

    const families = await db.select().from(centralSchema.familyRegistry).all();
    results.familyCount = families.length;
    results.families = families.map(f => ({ id: f.id.substring(0, 8), name: f.name, dbFilename: f.dbFilename }));

    const members = await db.select().from(centralSchema.familyMembers).all();
    results.memberCount = members.length;
    results.members = members.map(m => ({ userId: m.userId.substring(0, 8), familyId: m.familyId.substring(0, 8), role: m.role }));

    results.envDatabaseUrl = process.env.DATABASE_URL?.substring(0, 30) || '(not set)';

    results.status = 'ok';
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    results.status = 'error';
    results.error = err.message;
    results.cause = err.cause instanceof Error ? err.cause.message : undefined;
  }

  return NextResponse.json(results);
}
