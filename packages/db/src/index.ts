import 'dotenv/config';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export function createDb(url?: string) {
  return drizzle({
    connection: { source: url || process.env.DATABASE_URL || './ancstra.db' },
    schema,
  });
}

export type Database = ReturnType<typeof createDb>;
export * from './schema';
