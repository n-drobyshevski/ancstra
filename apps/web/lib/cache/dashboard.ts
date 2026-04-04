import { cacheLife, cacheTag } from 'next/cache';
import { getFamilyDb } from '../db';
import { persons, personNames, events, families, getQualitySummary } from '@ancstra/db';
import { eq, and, isNull, sql, gte } from 'drizzle-orm';
import type { PersonListItem } from '@ancstra/shared';

// ---------------------------------------------------------------------------
// Cached: stat cards (dashboard profile — 5min revalidate)
// ---------------------------------------------------------------------------
export async function getCachedStatCards(dbFilename: string) {
  'use cache';
  cacheLife('dashboard');
  cacheTag('dashboard-stats', 'persons');

  const db = await getFamilyDb(dbFilename);

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(isNull(persons.deletedAt))
    .all();
  const totalPersons = countRows[0]?.count ?? 0;

  const familyCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(families)
    .where(isNull(families.deletedAt))
    .all();
  const totalFamilies = familyCountRows[0]?.count ?? 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentAdditionsRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(and(isNull(persons.deletedAt), gte(persons.createdAt, thirtyDaysAgo)))
    .all();
  const recentAdditionsCount = recentAdditionsRows[0]?.count ?? 0;

  return { totalPersons, totalFamilies, recentAdditionsCount };
}

// ---------------------------------------------------------------------------
// Cached: recent persons (dashboard profile — 5min revalidate)
// ---------------------------------------------------------------------------
export async function getCachedRecentPersons(dbFilename: string) {
  'use cache';
  cacheLife('dashboard');
  cacheTag('dashboard-recent', 'persons');

  const db = await getFamilyDb(dbFilename);

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

  return recentPersons;
}

// ---------------------------------------------------------------------------
// Cached: quality score (genealogy profile — 1hr revalidate, remote cache)
// ---------------------------------------------------------------------------
export async function getCachedQualityScore(dbFilename: string) {
  'use cache: remote';
  cacheLife('genealogy');
  cacheTag('quality');

  const db = await getFamilyDb(dbFilename);
  const qualitySummary = await getQualitySummary(db);
  return qualitySummary.overallScore;
}
