import { cacheLife, cacheTag } from 'next/cache';
import { getFamilyDb } from '../db';
import { assemblePersonDetail, searchPersonsFts } from '../queries';
import { persons, personNames, events, sourceCitations } from '@ancstra/db';
import { isNull, sql, eq, count } from 'drizzle-orm';
import type { PersonListItem } from '@ancstra/shared';

// ---------------------------------------------------------------------------
// Cached: person detail (genealogy profile — 1hr revalidate)
// ---------------------------------------------------------------------------
export async function getCachedPersonDetail(dbFilename: string, personId: string) {
  'use cache';
  cacheLife('genealogy');
  cacheTag(`person-${personId}`, 'persons');

  const db = await getFamilyDb(dbFilename);
  return assemblePersonDetail(db, personId);
}

// ---------------------------------------------------------------------------
// Cached: citation count for a person (genealogy profile — 1hr revalidate)
// ---------------------------------------------------------------------------
export async function getCachedCitationCount(dbFilename: string, personId: string) {
  'use cache';
  cacheLife('genealogy');
  cacheTag(`person-${personId}`, 'persons');

  const db = await getFamilyDb(dbFilename);
  const result = await db
    .select({ value: count() })
    .from(sourceCitations)
    .where(eq(sourceCitations.personId, personId))
    .get();
  return result?.value ?? 0;
}

// ---------------------------------------------------------------------------
// Cached: paginated persons list with optional FTS search (dashboard profile)
// ---------------------------------------------------------------------------
export async function getCachedPersonsList(
  dbFilename: string,
  page: number,
  pageSize: number,
  query?: string
) {
  'use cache';
  cacheLife('dashboard');
  cacheTag('persons-list', 'persons');

  const db = await getFamilyDb(dbFilename);
  const offset = (page - 1) * pageSize;

  if (query) {
    const allResults = await searchPersonsFts(db, query, 1000);
    const total = allResults.length;
    const items = allResults.slice(offset, offset + pageSize);
    return { items, total, page, pageSize };
  }

  const whereClause = isNull(persons.deletedAt);

  const rows = await db
    .select({
      id: persons.id,
      sex: persons.sex,
      isLiving: persons.isLiving,
      givenName: personNames.givenName,
      surname: personNames.surname,
    })
    .from(persons)
    .innerJoin(
      personNames,
      sql`${personNames.personId} = ${persons.id} AND ${personNames.isPrimary} = 1`
    )
    .where(whereClause)
    .limit(pageSize)
    .offset(offset)
    .all();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(whereClause)
    .all();

  const personIds = rows.map((r) => r.id);
  const birthDeathEvents =
    personIds.length > 0
      ? await db
          .select({
            personId: events.personId,
            eventType: events.eventType,
            dateOriginal: events.dateOriginal,
          })
          .from(events)
          .where(
            sql`${events.personId} IN (${sql.join(
              personIds.map((id) => sql`${id}`),
              sql`, `
            )}) AND ${events.eventType} IN ('birth', 'death')`
          )
          .all()
      : [];

  const eventsByPerson = new Map<string, { birthDate?: string | null; deathDate?: string | null }>();
  for (const ev of birthDeathEvents) {
    if (!ev.personId) continue;
    const entry = eventsByPerson.get(ev.personId) ?? {};
    if (ev.eventType === 'birth') entry.birthDate = ev.dateOriginal;
    if (ev.eventType === 'death') entry.deathDate = ev.dateOriginal;
    eventsByPerson.set(ev.personId, entry);
  }

  const items: PersonListItem[] = rows.map((r) => ({
    ...r,
    birthDate: eventsByPerson.get(r.id)?.birthDate ?? null,
    deathDate: eventsByPerson.get(r.id)?.deathDate ?? null,
  }));

  return { items, total: count, page, pageSize };
}
