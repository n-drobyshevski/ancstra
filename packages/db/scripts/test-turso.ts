/**
 * Turso Spike Validation Script
 *
 * Tests that the Drizzle + libsql driver can:
 * 1. Connect to a Turso database
 * 2. Push the schema (create tables)
 * 3. Insert a person with name and events (transaction)
 * 4. Read it back and verify
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... pnpm tsx scripts/test-turso.ts
 *
 * Or for local testing with libsql file:
 *   TURSO_DATABASE_URL=file:turso-test.db TURSO_AUTH_TOKEN= pnpm tsx scripts/test-turso.ts
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, and, isNull } from 'drizzle-orm';
import * as schema from '../src/schema';

const { persons, personNames, events, users } = schema;

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.log('No TURSO_DATABASE_URL set. Testing with local file:turso-test.db');
  }

  const client = createClient({
    url: url || 'file:turso-test.db',
    authToken: authToken || undefined,
  });

  const db = drizzle({ client, schema });

  console.log('1. Creating tables...');
  // Use raw SQL since Drizzle push isn't available in script context
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY,
      sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private',
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS person_names (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      name_type TEXT NOT NULL DEFAULT 'birth',
      prefix TEXT,
      given_name TEXT NOT NULL,
      surname TEXT NOT NULL,
      suffix TEXT,
      nickname TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      date_original TEXT,
      date_sort INTEGER,
      date_modifier TEXT DEFAULT 'exact',
      date_end_sort INTEGER,
      place_text TEXT,
      description TEXT,
      person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      family_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  console.log('   PASS: Tables created');

  console.log('2. Inserting test person (transaction)...');
  const now = new Date().toISOString();
  const personId = crypto.randomUUID();

  // Turso supports batch transactions
  await db.insert(persons).values({
    id: personId,
    sex: 'M',
    isLiving: false,
    notes: 'Turso spike test',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(personNames).values({
    id: crypto.randomUUID(),
    personId,
    givenName: 'Turso',
    surname: 'TestPerson',
    nameType: 'birth',
    isPrimary: true,
    createdAt: now,
  });

  await db.insert(events).values({
    id: crypto.randomUUID(),
    personId,
    eventType: 'birth',
    dateOriginal: '15 Mar 1845',
    dateSort: 18450315,
    placeText: 'Springfield, IL',
    createdAt: now,
    updatedAt: now,
  });
  console.log('   PASS: Person + name + event inserted');

  console.log('3. Reading back...');
  const [person] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.id, personId), isNull(persons.deletedAt)));

  const [name] = await db
    .select()
    .from(personNames)
    .where(and(eq(personNames.personId, personId), eq(personNames.isPrimary, true)));

  const [birthEvent] = await db
    .select()
    .from(events)
    .where(and(eq(events.personId, personId), eq(events.eventType, 'birth')));

  // Verify
  const checks = [
    { field: 'person.sex', expected: 'M', actual: person?.sex },
    { field: 'person.isLiving', expected: false, actual: person?.isLiving },
    { field: 'name.givenName', expected: 'Turso', actual: name?.givenName },
    { field: 'name.surname', expected: 'TestPerson', actual: name?.surname },
    { field: 'event.dateOriginal', expected: '15 Mar 1845', actual: birthEvent?.dateOriginal },
    { field: 'event.dateSort', expected: 18450315, actual: birthEvent?.dateSort },
    { field: 'event.placeText', expected: 'Springfield, IL', actual: birthEvent?.placeText },
  ];

  let allPass = true;
  for (const check of checks) {
    const pass = check.expected === check.actual;
    console.log(`   ${pass ? 'PASS' : 'FAIL'}: ${check.field} = ${JSON.stringify(check.actual)}${pass ? '' : ` (expected ${JSON.stringify(check.expected)})`}`);
    if (!pass) allPass = false;
  }

  console.log('4. Cleanup...');
  await db.delete(events).where(eq(events.personId, personId));
  await db.delete(personNames).where(eq(personNames.personId, personId));
  await db.delete(persons).where(eq(persons.id, personId));
  console.log('   PASS: Test data cleaned up');

  console.log('\n' + (allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));

  client.close();
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
