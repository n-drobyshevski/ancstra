import { cacheLife, cacheTag } from 'next/cache';
import { getFamilyDb } from '../db';
import { persons, personNames, events, families, getQualitySummary } from '@ancstra/db';
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { PersonListItem } from '@ancstra/shared';

// ---------------------------------------------------------------------------
// Cached: stat cards (dashboard profile — 5min revalidate)
// ---------------------------------------------------------------------------
export async function getCachedStatCards(dbFilename: string) {
  'use cache';
  cacheLife('dashboard');
  cacheTag('dashboard-stats', 'persons');

  const db = await getFamilyDb(dbFilename);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Two parallel queries: one merged persons aggregation (total + 30d recent),
  // and one families count. Replaces three sequential round-trips.
  const [personsRows, familiesRows] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        recent: sql<number>`sum(case when ${persons.createdAt} >= ${thirtyDaysAgo} then 1 else 0 end)`,
      })
      .from(persons)
      .where(isNull(persons.deletedAt))
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(families)
      .where(isNull(families.deletedAt))
      .all(),
  ]);

  const totalPersons = personsRows[0]?.total ?? 0;
  const recentAdditionsCount = personsRows[0]?.recent ?? 0;
  const totalFamilies = familiesRows[0]?.count ?? 0;

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

  // Single query: persons + primary name + first birth event (via correlated
  // subquery). Replaces the previous two-round-trip pattern (persons query +
  // follow-up events IN-list).
  const recentRows = await db
    .select({
      id: persons.id,
      sex: persons.sex,
      isLiving: persons.isLiving,
      givenName: personNames.givenName,
      surname: personNames.surname,
      createdAt: persons.createdAt,
      birthDate: sql<string | null>`(
        SELECT ${events.dateOriginal}
        FROM ${events}
        WHERE ${events.personId} = ${persons.id}
          AND ${events.eventType} = 'birth'
        ORDER BY ${events.dateSort}
        LIMIT 1
      )`,
    })
    .from(persons)
    .innerJoin(personNames, eq(personNames.personId, persons.id))
    .where(and(isNull(persons.deletedAt), eq(personNames.isPrimary, true)))
    .orderBy(sql`${persons.createdAt} DESC`)
    .limit(5)
    .all();

  const recentPersons: (PersonListItem & { createdAt: string })[] = recentRows.map((r) => ({
    id: r.id,
    givenName: r.givenName ?? '',
    surname: r.surname ?? '',
    sex: r.sex as 'M' | 'F' | 'U',
    isLiving: r.isLiving,
    birthDate: r.birthDate ?? null,
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
