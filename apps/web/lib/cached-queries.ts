import { cacheLife, cacheTag } from 'next/cache';
import { getFamilyDb } from './db';
import { assemblePersonDetail, getTreeData } from './queries';
import { persons, personNames, events } from '@ancstra/db';
import { eq, and, isNull, sql } from 'drizzle-orm';
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
// Cached: full tree data (tree profile — 30min revalidate)
// ---------------------------------------------------------------------------
export async function getCachedTreeData(dbFilename: string) {
  'use cache';
  cacheLife('tree');
  cacheTag('tree-data', 'persons');

  const db = await getFamilyDb(dbFilename);
  return getTreeData(db);
}

// ---------------------------------------------------------------------------
// Cached: dashboard data (dashboard profile — 5min revalidate)
// ---------------------------------------------------------------------------
export async function getCachedDashboardData(dbFilename: string) {
  'use cache';
  cacheLife('dashboard');
  cacheTag('dashboard', 'persons');

  const db = await getFamilyDb(dbFilename);

  // Fetch last 5 persons ordered by created_at desc
  const recentRows = await db
    .select({
      id: persons.id,
      sex: persons.sex,
      isLiving: persons.isLiving,
      givenName: personNames.givenName,
      surname: personNames.surname,
      createdAt: persons.createdAt,
    })
    .from(persons)
    .innerJoin(personNames, eq(personNames.personId, persons.id))
    .where(and(isNull(persons.deletedAt), eq(personNames.isPrimary, true)))
    .orderBy(sql`${persons.createdAt} DESC`)
    .limit(5)
    .all();

  // Get birth dates for recent persons
  const recentIds = recentRows.map((r) => r.id);
  const birthEvents =
    recentIds.length > 0
      ? await db
          .select({
            personId: events.personId,
            dateOriginal: events.dateOriginal,
          })
          .from(events)
          .where(
            sql`${events.personId} IN (${sql.join(
              recentIds.map((id) => sql`${id}`),
              sql`, `
            )}) AND ${events.eventType} = 'birth'`
          )
          .all()
      : [];

  const birthByPerson = new Map(
    birthEvents.map((e) => [e.personId, e.dateOriginal])
  );

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(isNull(persons.deletedAt))
    .all();
  const totalPersons = countRows[0]?.count ?? 0;

  const recentPersons: (PersonListItem & { createdAt: string })[] = recentRows.map((r) => ({
    id: r.id,
    givenName: r.givenName ?? '',
    surname: r.surname ?? '',
    sex: r.sex as 'M' | 'F' | 'U',
    isLiving: r.isLiving,
    birthDate: birthByPerson.get(r.id) ?? null,
    deathDate: null,
    createdAt: r.createdAt,
  }));

  return { recentPersons, totalPersons };
}
