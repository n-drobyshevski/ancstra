import { cacheLife, cacheTag } from 'next/cache';
import { eq, and, isNull, gte, sql } from 'drizzle-orm';
import { persons, personNames, events, sources } from '@ancstra/db';
import { getFamilyDb } from '@/lib/db';

// ---------------------------------------------------------------------------
// Viewer hero — Featured ancestor (deterministic daily rotation)
// ---------------------------------------------------------------------------
export type FeaturedAncestor = {
  id: string;
  givenName: string;
  surname: string;
  sex: 'M' | 'F' | 'U';
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
} | null;

/**
 * djb2 string hash. Stable across processes; avoids pulling a crypto dep just
 * to choose a daily offset. The output is a non-negative integer suitable for
 * use as a SQL OFFSET via `% count`.
 */
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0; // force unsigned 32-bit
}

/**
 * Picks a deceased person to spotlight on the viewer dashboard. The same
 * person stays featured for the whole UTC day (cache key = familyId+dateSeed)
 * and rotates at midnight UTC when callers pass the new date string.
 *
 * Fallback chain:
 *   1. Random deceased person at deterministic offset.
 *   2. If no deceased exist (small/new tree) — fall through to any non-deleted
 *      person at the same offset.
 *   3. Empty tree — `null`.
 *
 * @param dateSeed YYYY-MM-DD UTC. Caller passes today's date so cache rotates daily.
 */
export async function getCachedFeaturedAncestor(
  dbFilename: string,
  familyId: string,
  dateSeed: string,
): Promise<FeaturedAncestor> {
  'use cache';
  cacheLife('genealogy');
  cacheTag('persons', `featured-ancestor-${familyId}-${dateSeed}`);

  const db = await getFamilyDb(dbFilename);

  // Count eligible (deceased) first — small tree fallback to "any person"
  // is cheaper than a complex "deceased OR fallback" query.
  const deceasedCount = (
    await db
      .select({ count: sql<number>`count(*)` })
      .from(persons)
      .where(and(isNull(persons.deletedAt), eq(persons.isLiving, false)))
      .all()
  )[0]?.count ?? 0;

  let total = deceasedCount;
  let restrictToDeceased = true;

  if (total === 0) {
    const allCount = (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(persons)
        .where(isNull(persons.deletedAt))
        .all()
    )[0]?.count ?? 0;
    total = allCount;
    restrictToDeceased = false;
  }

  if (total === 0) return null;

  const offset = djb2(`${familyId}|${dateSeed}`) % total;

  const where = restrictToDeceased
    ? and(isNull(persons.deletedAt), eq(persons.isLiving, false), eq(personNames.isPrimary, true))
    : and(isNull(persons.deletedAt), eq(personNames.isPrimary, true));

  const row = await db
    .select({
      id: persons.id,
      sex: persons.sex,
      givenName: personNames.givenName,
      surname: personNames.surname,
      birthDate: sql<string | null>`(
        SELECT ${events.dateOriginal}
        FROM ${events}
        WHERE ${events.personId} = ${persons.id}
          AND ${events.eventType} = 'birth'
        ORDER BY ${events.dateSort}
        LIMIT 1
      )`,
      deathDate: sql<string | null>`(
        SELECT ${events.dateOriginal}
        FROM ${events}
        WHERE ${events.personId} = ${persons.id}
          AND ${events.eventType} = 'death'
        ORDER BY ${events.dateSort}
        LIMIT 1
      )`,
      birthPlace: sql<string | null>`(
        SELECT ${events.placeText}
        FROM ${events}
        WHERE ${events.personId} = ${persons.id}
          AND ${events.eventType} = 'birth'
        ORDER BY ${events.dateSort}
        LIMIT 1
      )`,
    })
    .from(persons)
    .innerJoin(personNames, eq(personNames.personId, persons.id))
    .where(where)
    .orderBy(persons.id)
    .limit(1)
    .offset(offset)
    .get();

  if (!row) return null;
  return {
    id: row.id,
    givenName: row.givenName ?? '',
    surname: row.surname ?? '',
    sex: row.sex as 'M' | 'F' | 'U',
    birthDate: row.birthDate ?? null,
    deathDate: row.deathDate ?? null,
    birthPlace: row.birthPlace ?? null,
  };
}

// ---------------------------------------------------------------------------
// Viewer aside — What's-new milestones (last 7 days)
// ---------------------------------------------------------------------------
export type WhatsNewMilestones = {
  /** Calendar window the rollup covers, in days. Echoed for display. */
  windowDays: number;
  personsAdded: number;
  eventsAdded: number;
  sourcesAdded: number;
  /** Convenience flag — true iff every counter is zero. */
  isQuiet: boolean;
};

/**
 * Aggregates "things that happened recently" so a viewer has a rollup of
 * activity *they* care about (records, events, sources) rather than the raw
 * audit log. Window is hardcoded to 7d for v2.0 — make it a param if a future
 * variant needs 30d/90d.
 */
export async function getCachedWhatsNewMilestones(
  dbFilename: string,
): Promise<WhatsNewMilestones> {
  'use cache';
  cacheLife('dashboard');
  cacheTag('whats-new', 'persons', 'events', 'sources');

  const windowDays = 7;
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const db = await getFamilyDb(dbFilename);

  const [pRows, eRows, sRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(persons)
      .where(and(isNull(persons.deletedAt), gte(persons.createdAt, cutoff)))
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(gte(events.createdAt, cutoff))
      .all(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(sources)
      .where(gte(sources.createdAt, cutoff))
      .all(),
  ]);

  const personsAdded = pRows[0]?.count ?? 0;
  const eventsAdded = eRows[0]?.count ?? 0;
  const sourcesAdded = sRows[0]?.count ?? 0;

  return {
    windowDays,
    personsAdded,
    eventsAdded,
    sourcesAdded,
    isQuiet: personsAdded + eventsAdded + sourcesAdded === 0,
  };
}
