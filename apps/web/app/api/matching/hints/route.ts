import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, matchCandidates, persons, personNames, events } from '@ancstra/db';
import { eq, and } from 'drizzle-orm';
import {
  ProviderRegistry,
  MockProvider,
  NARAProvider,
  ChroniclingAmericaProvider,
} from '@ancstra/research';
import type { SearchRequest } from '@ancstra/research';
import { generateHintsForPerson } from '@ancstra/matching';
import type { LocalPersonData, SearchResultInput } from '@ancstra/matching';

function buildRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  if (process.env.NODE_ENV === 'development') {
    registry.register(new MockProvider());
  }
  registry.register(new NARAProvider());
  registry.register(new ChroniclingAmericaProvider());
  return registry;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('personId');
    const status = searchParams.get('status') as 'pending' | 'accepted' | 'rejected' | 'maybe' | null;

    if (!personId) {
      return NextResponse.json({ error: 'personId is required' }, { status: 400 });
    }

    const db = createDb();

    const conditions = [eq(matchCandidates.personId, personId)];
    if (status) {
      conditions.push(eq(matchCandidates.matchStatus, status));
    }

    const hints = db
      .select()
      .from(matchCandidates)
      .where(and(...conditions))
      .orderBy(matchCandidates.matchScore)
      .all()
      .reverse(); // descending by score

    return NextResponse.json({ hints, count: hints.length });
  } catch (err) {
    console.error('[matching/hints GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { personId } = body;

    if (!personId) {
      return NextResponse.json({ error: 'personId is required' }, { status: 400 });
    }

    const db = createDb();

    // Fetch person data
    const person = db.select().from(persons).where(eq(persons.id, personId)).get();
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Fetch primary name
    const name = db
      .select()
      .from(personNames)
      .where(eq(personNames.personId, personId))
      .limit(1)
      .get();

    if (!name) {
      return NextResponse.json({ error: 'Person has no name record' }, { status: 400 });
    }

    // Fetch birth/death events
    const personEvents = db
      .select()
      .from(events)
      .where(eq(events.personId, personId))
      .all();

    const birthEvent = personEvents.find((e) => e.eventType === 'birth');
    const deathEvent = personEvents.find((e) => e.eventType === 'death');

    const localPerson: LocalPersonData = {
      givenName: name.givenName,
      surname: name.surname,
      birthDateSort: birthEvent?.dateSort ?? null,
      birthPlace: birthEvent?.placeText ?? null,
      deathDateSort: deathEvent?.dateSort ?? null,
      deathPlace: deathEvent?.placeText ?? null,
    };

    // Search across providers
    const searchRequest: SearchRequest = {
      givenName: name.givenName,
      surname: name.surname,
      birthYear: birthEvent?.dateSort ? Math.floor(birthEvent.dateSort / 10000) : undefined,
      birthPlace: birthEvent?.placeText ?? undefined,
      limit: 50,
    };

    const registry = buildRegistry();
    const rawResults = await registry.searchAll(searchRequest);

    // Map search results to pipeline input
    const searchResults: SearchResultInput[] = rawResults.map((r) => ({
      providerId: r.providerId,
      externalId: r.externalId ?? crypto.randomUUID(),
      title: r.title,
      snippet: r.snippet ?? '',
      url: r.url ?? '',
      extractedData: r.extractedData ?? {
        name: r.title,
      },
    }));

    // Score and filter
    const hints = generateHintsForPerson(localPerson, searchResults);

    // Upsert into match_candidates
    let newCount = 0;
    for (const hint of hints) {
      const existing = db
        .select()
        .from(matchCandidates)
        .where(
          and(
            eq(matchCandidates.personId, personId),
            eq(matchCandidates.sourceSystem, hint.providerId),
            eq(matchCandidates.externalId, hint.externalId),
          ),
        )
        .get();

      if (existing) {
        // Update score if changed
        db.update(matchCandidates)
          .set({
            matchScore: hint.matchScore,
            externalData: JSON.stringify({
              ...hint.externalData,
              components: hint.components,
              url: hint.url,
              title: hint.title,
            }),
          })
          .where(eq(matchCandidates.id, existing.id))
          .run();
      } else {
        db.insert(matchCandidates)
          .values({
            personId,
            sourceSystem: hint.providerId,
            externalId: hint.externalId,
            externalData: JSON.stringify({
              ...hint.externalData,
              components: hint.components,
              url: hint.url,
              title: hint.title,
            }),
            matchScore: hint.matchScore,
          })
          .run();
        newCount++;
      }
    }

    return NextResponse.json({
      generated: hints.length,
      newHints: newCount,
      totalSearchResults: rawResults.length,
    });
  } catch (err) {
    console.error('[matching/hints POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
