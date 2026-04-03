import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  GotenbergClient,
  renderPersonBiographyHtml,
  renderFamilyHistoryHtml,
} from '@ancstra/export';
import {
  biographies,
  persons,
  personNames,
  events,
  sourceCitations,
  sources,
} from '@ancstra/db';
import { eq, and } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { ctx, familyDb } = await withAuth('gedcom:export');
    const body = await request.json();
    const { template, personId, options = {} } = body;

    const gotenberg = new GotenbergClient();
    const available = await gotenberg.isAvailable();

    let html: string | null;

    if (template === 'person-biography') {
      if (!personId) {
        return NextResponse.json({ error: 'personId required' }, { status: 400 });
      }

      html = await buildPersonBiographyHtml(familyDb, personId);
      if (!html) {
        return NextResponse.json({ error: 'Person not found' }, { status: 404 });
      }
    } else if (template === 'family-history') {
      html = await buildFamilyHistoryHtml(familyDb, ctx.userId, options.familyName);
    } else {
      return NextResponse.json({ error: 'Invalid template' }, { status: 400 });
    }

    if (!available) {
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'X-PDF-Fallback': 'true',
        },
      });
    }

    const pdfBuffer = await gotenberg.htmlToPdf(html!);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${template}.pdf"`,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildPersonBiographyHtml(
  familyDb: ReturnType<typeof import('@ancstra/db').createFamilyDb>,
  personId: string,
): Promise<string | null> {
  const person = await familyDb.select().from(persons).where(eq(persons.id, personId)).get();
  if (!person) return null;

  const primaryName = await familyDb
    .select()
    .from(personNames)
    .where(and(eq(personNames.personId, personId), eq(personNames.isPrimary, true)))
    .get();

  const name = primaryName
    ? `${primaryName.givenName} ${primaryName.surname}`
    : 'Unknown';

  // Gather events sorted by date
  const personEvents = await familyDb
    .select()
    .from(events)
    .where(eq(events.personId, personId))
    .all();

  personEvents.sort((a, b) => (a.dateSort ?? 0) - (b.dateSort ?? 0));

  // Compute date range from birth/death events
  const birthEvent = personEvents.find((e) => e.eventType === 'BIRT');
  const deathEvent = personEvents.find((e) => e.eventType === 'DEAT');
  const dates = formatDateRange(birthEvent?.dateOriginal, deathEvent?.dateOriginal);

  // Get cached biography (most recent)
  const bio = await familyDb
    .select()
    .from(biographies)
    .where(eq(biographies.personId, personId))
    .limit(1)
    .get();

  // Gather source citations linked to this person or their events
  const personCitations = await familyDb
    .select({
      title: sources.title,
      citation: sourceCitations.citationDetail,
    })
    .from(sourceCitations)
    .innerJoin(sources, eq(sourceCitations.sourceId, sources.id))
    .where(eq(sourceCitations.personId, personId))
    .all();

  const eventIds = personEvents.map((e) => e.id);
  const eventCitations = eventIds.length > 0
    ? (await Promise.all(eventIds.map((eventId) =>
        familyDb
          .select({
            title: sources.title,
            citation: sourceCitations.citationDetail,
          })
          .from(sourceCitations)
          .innerJoin(sources, eq(sourceCitations.sourceId, sources.id))
          .where(eq(sourceCitations.eventId, eventId))
          .all(),
      ))).flat()
    : [];

  // Deduplicate sources by title
  const allCitations = [...personCitations, ...eventCitations];
  const seen = new Set<string>();
  const uniqueSources = allCitations.filter((s) => {
    const key = `${s.title}::${s.citation ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return renderPersonBiographyHtml({
    name,
    dates,
    biography: bio?.content || 'No biography generated yet.',
    events: personEvents.map((e) => ({
      date: e.dateOriginal || '',
      type: e.eventType,
      place: e.placeText || '',
    })),
    sources: uniqueSources.map((s) => ({
      title: s.title,
      citation: s.citation || '',
    })),
  });
}

async function buildFamilyHistoryHtml(
  familyDb: ReturnType<typeof import('@ancstra/db').createFamilyDb>,
  compiledBy: string,
  familyName?: string,
): Promise<string> {
  // Gather all persons with primary names, biographies, and events
  const allPersons = await familyDb.select().from(persons).all();

  const personsData = await Promise.all(allPersons.map(async (person) => {
    const primaryName = await familyDb
      .select()
      .from(personNames)
      .where(and(eq(personNames.personId, person.id), eq(personNames.isPrimary, true)))
      .get();

    const name = primaryName
      ? `${primaryName.givenName} ${primaryName.surname}`
      : 'Unknown';

    const personEvents = await familyDb
      .select()
      .from(events)
      .where(eq(events.personId, person.id))
      .all();

    personEvents.sort((a, b) => (a.dateSort ?? 0) - (b.dateSort ?? 0));

    const birthEvent = personEvents.find((e) => e.eventType === 'BIRT');
    const deathEvent = personEvents.find((e) => e.eventType === 'DEAT');
    const dates = formatDateRange(birthEvent?.dateOriginal, deathEvent?.dateOriginal);

    const bio = await familyDb
      .select()
      .from(biographies)
      .where(eq(biographies.personId, person.id))
      .limit(1)
      .get();

    // Approximate generation from birth year (generation 1 = earliest)
    const birthYear = birthEvent?.dateSort
      ? Math.floor(birthEvent.dateSort / 10000)
      : 9999;

    return {
      name,
      dates,
      biography: bio?.content,
      events: personEvents.map((e) => ({
        date: e.dateOriginal || '',
        type: e.eventType,
        place: e.placeText || '',
      })),
      birthYear,
      surname: primaryName?.surname || '',
      generation: 1, // placeholder, computed below
    };
  }));

  // Sort by birth year and assign generation buckets (~30 year spans)
  personsData.sort((a, b) => a.birthYear - b.birthYear);

  if (personsData.length > 0) {
    const earliestYear = personsData[0].birthYear;
    for (const p of personsData) {
      if (p.birthYear === 9999) {
        // Unknown birth year — put in last generation
        p.generation = personsData.length > 1
          ? Math.max(...personsData.filter((x) => x.birthYear !== 9999).map((x) => x.generation), 1)
          : 1;
      } else {
        p.generation = Math.max(1, Math.floor((p.birthYear - earliestYear) / 30) + 1);
      }
    }
  }

  // Determine family name from the most common surname
  const surnameCounts: Record<string, number> = {};
  for (const p of personsData) {
    if (p.surname) {
      surnameCounts[p.surname] = (surnameCounts[p.surname] || 0) + 1;
    }
  }
  const derivedFamilyName = familyName
    || Object.entries(surnameCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    || 'Family';

  return renderFamilyHistoryHtml({
    familyName: derivedFamilyName,
    compiledBy,
    compiledDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    persons: personsData.map(({ name, dates, biography, events: evts, generation }) => ({
      name,
      dates,
      biography,
      events: evts,
      generation,
    })),
  });
}

function formatDateRange(
  birthDate: string | null | undefined,
  deathDate: string | null | undefined,
): string {
  if (birthDate && deathDate) return `${birthDate} – ${deathDate}`;
  if (birthDate) return `b. ${birthDate}`;
  if (deathDate) return `d. ${deathDate}`;
  return 'Dates unknown';
}
