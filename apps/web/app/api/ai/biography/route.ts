import { streamText } from 'ai';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { centralSchema, biographies, persons, personNames, events, families, children, sources, sourceCitations } from '@ancstra/db';
import {
  buildBiographyPrompt,
  getModel,
  checkBudget,
  recordUsage,
  calculateCost,
  type BiographyOptions,
  type PersonBioData,
} from '@ancstra/ai';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const url = new URL(request.url);
    const personId = url.searchParams.get('personId');
    const tone = url.searchParams.get('tone') || 'conversational';
    const length = url.searchParams.get('length') || 'standard';
    const focus = url.searchParams.get('focus') || 'life_overview';

    if (!personId) {
      return NextResponse.json({ error: 'personId required' }, { status: 400 });
    }

    const cached = await familyDb
      .select()
      .from(biographies)
      .where(and(
        eq(biographies.personId, personId),
        eq(biographies.tone, tone),
        eq(biographies.length, length),
        eq(biographies.focus, focus),
      ))
      .get();

    if (cached) {
      return NextResponse.json({ cached: true, content: cached.content });
    }
    return NextResponse.json({ cached: false });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { ctx, familyDb, centralDb } = await withAuth('ai:research');

    const body = await request.json();
    const { personId, tone = 'conversational', length = 'standard', focus = 'life_overview' } = body;

    if (!personId) {
      return NextResponse.json({ error: 'personId required' }, { status: 400 });
    }

    // Read budget limit from central DB
    let monthlyLimit = parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? '10');
    try {
      const [family] = await centralDb
        .select({ budget: centralSchema.familyRegistry.monthlyAiBudgetUsd })
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
        .all();
      if (family) {
        monthlyLimit = family.budget;
      }
    } catch (err) {
      console.warn('Failed to read budget from central DB, using env fallback:', err);
    }

    // Check budget
    const budget = await checkBudget(familyDb, monthlyLimit);
    if (budget.overBudget) {
      return NextResponse.json(
        { blocked: true, spent: budget.spent, limit: monthlyLimit },
        { status: 429 }
      );
    }

    // Gather person data
    const person = await familyDb.select().from(persons).where(eq(persons.id, personId)).get();
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const names = await familyDb
      .select()
      .from(personNames)
      .where(eq(personNames.personId, personId))
      .all();

    const primaryName = names.find(n => n.isPrimary) || names[0];
    if (!primaryName) {
      return NextResponse.json({ error: 'Person has no name records' }, { status: 400 });
    }

    const personEvents = await familyDb
      .select()
      .from(events)
      .where(eq(events.personId, personId))
      .all();

    const birthEvent = personEvents.find(e => e.eventType === 'birth');
    const deathEvent = personEvents.find(e => e.eventType === 'death');

    // Get parents: find families where this person is a child
    const childRecords = await familyDb
      .select()
      .from(children)
      .where(eq(children.personId, personId))
      .all();

    const parentNames: PersonBioData['parents'] = [];
    for (const childRec of childRecords) {
      const family = await familyDb.select().from(families).where(eq(families.id, childRec.familyId)).get();
      if (!family) continue;
      for (const partnerId of [family.partner1Id, family.partner2Id]) {
        if (!partnerId) continue;
        const pName = await familyDb.select().from(personNames).where(and(eq(personNames.personId, partnerId), eq(personNames.isPrimary, true))).get()
          || await familyDb.select().from(personNames).where(eq(personNames.personId, partnerId)).get();
        if (pName) {
          const pBirth = await familyDb.select().from(events).where(and(eq(events.personId, partnerId), eq(events.eventType, 'birth'))).get();
          parentNames.push({
            name: `${pName.givenName} ${pName.surname}`,
            birthYear: pBirth?.dateSort ? new Date(pBirth.dateSort).getFullYear() : undefined,
          });
        }
      }
    }

    // Get spouses: find families where this person is a partner
    const spouseNames: PersonBioData['spouses'] = [];
    const asPartner1 = await familyDb.select().from(families).where(eq(families.partner1Id, personId)).all();
    const asPartner2 = await familyDb.select().from(families).where(eq(families.partner2Id, personId)).all();
    const allFamilies = [...asPartner1, ...asPartner2];

    for (const fam of allFamilies) {
      const spouseId = fam.partner1Id === personId ? fam.partner2Id : fam.partner1Id;
      if (!spouseId) continue;
      const sName = await familyDb.select().from(personNames).where(and(eq(personNames.personId, spouseId), eq(personNames.isPrimary, true))).get()
        || await familyDb.select().from(personNames).where(eq(personNames.personId, spouseId)).get();
      if (sName) {
        const marriageEvent = await familyDb.select().from(events).where(and(eq(events.familyId, fam.id), eq(events.eventType, 'marriage'))).get();
        spouseNames.push({
          name: `${sName.givenName} ${sName.surname}`,
          marriageDate: marriageEvent?.dateOriginal ?? undefined,
        });
      }
    }

    // Get children
    const childNames: PersonBioData['children'] = [];
    for (const fam of allFamilies) {
      const familyChildren = await familyDb.select().from(children).where(eq(children.familyId, fam.id)).all();
      for (const child of familyChildren) {
        const cName = await familyDb.select().from(personNames).where(and(eq(personNames.personId, child.personId), eq(personNames.isPrimary, true))).get()
          || await familyDb.select().from(personNames).where(eq(personNames.personId, child.personId)).get();
        if (cName) {
          const cBirth = await familyDb.select().from(events).where(and(eq(events.personId, child.personId), eq(events.eventType, 'birth'))).get();
          childNames.push({
            name: `${cName.givenName} ${cName.surname}`,
            birthYear: cBirth?.dateSort ? new Date(cBirth.dateSort).getFullYear() : undefined,
          });
        }
      }
    }

    // Get sources
    const citations = await familyDb
      .select()
      .from(sourceCitations)
      .where(eq(sourceCitations.personId, personId))
      .all();

    const personSources: PersonBioData['sources'] = [];
    for (const cit of citations) {
      const src = await familyDb.select().from(sources).where(eq(sources.id, cit.sourceId)).get();
      if (src) {
        personSources.push({
          title: src.title,
          citationText: cit.citationText ?? undefined,
        });
      }
    }

    // Build prompt
    const bioData: PersonBioData = {
      name: `${primaryName.givenName} ${primaryName.surname}`,
      birthDate: birthEvent?.dateOriginal ?? undefined,
      birthPlace: birthEvent?.placeText ?? undefined,
      deathDate: deathEvent?.dateOriginal ?? undefined,
      deathPlace: deathEvent?.placeText ?? undefined,
      sex: person.sex,
      events: personEvents
        .filter(e => e.eventType !== 'birth' && e.eventType !== 'death')
        .map(e => ({
          type: e.eventType,
          date: e.dateOriginal ?? undefined,
          place: e.placeText ?? undefined,
          description: e.description ?? undefined,
        })),
      parents: parentNames,
      spouses: spouseNames,
      children: childNames,
      sources: personSources,
    };

    const options: BiographyOptions = {
      tone: tone as BiographyOptions['tone'],
      length: length as BiographyOptions['length'],
      focus: focus as BiographyOptions['focus'],
    };

    const prompt = buildBiographyPrompt(bioData, options);
    const model = getModel('analysis'); // Sonnet for quality biography writing
    const userId = ctx.userId;

    const result = streamText({
      model,
      prompt,
      onFinish: async ({ text, usage }) => {
        try {
          const modelName = 'claude-sonnet-4-5';
          const costUsd = calculateCost(modelName, usage.promptTokens, usage.completionTokens);

          // Cache biography (INSERT OR REPLACE via unique constraint)
          await familyDb
            .insert(biographies)
            .values({
              personId,
              tone: options.tone,
              length: options.length,
              focus: options.focus,
              content: text,
              model: modelName,
              inputTokens: usage.promptTokens,
              outputTokens: usage.completionTokens,
              costUsd,
            })
            .onConflictDoUpdate({
              target: [biographies.personId, biographies.tone, biographies.length, biographies.focus],
              set: {
                content: text,
                model: modelName,
                inputTokens: usage.promptTokens,
                outputTokens: usage.completionTokens,
                costUsd,
                createdAt: new Date().toISOString(),
              },
            })
            .run();

          // Record usage
          await recordUsage(familyDb, {
            userId,
            model: modelName,
            inputTokens: usage.promptTokens,
            outputTokens: usage.completionTokens,
            taskType: 'biography',
          });
        } catch (err) {
          console.error('Failed to cache biography or record usage:', err);
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[ai/biography POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
