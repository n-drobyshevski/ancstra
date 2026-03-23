import { NextResponse } from 'next/server';
import { createCentralDb, centralSchema } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    results.envSet = !!process.env.CENTRAL_DATABASE_URL;
    results.envPrefix = process.env.CENTRAL_DATABASE_URL?.substring(0, 30);

    const db = createCentralDb();
    results.dbCreated = true;

    const users = await db.select().from(centralSchema.users).all();
    results.userCount = users.length;
    results.users = users.map(u => ({ email: u.email, hasPassword: !!u.passwordHash }));

    if (users.length > 0 && users[0].passwordHash) {
      const valid = await bcrypt.compare('password', users[0].passwordHash);
      results.passwordCheck = valid;
    }
  } catch (error: any) {
    results.error = error.message;
    results.stack = error.stack?.split('\n').slice(0, 3);
  }

  return NextResponse.json(results);
}
