import { generateText } from 'ai';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { centralSchema, historicalContext, persons, personNames, events } from '@ancstra/db';
import {
  buildHistoricalContextPrompt,
  getModel,
  checkBudget,
  recordUsage,
  calculateCost,
} from '@ancstra/ai';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const url = new URL(request.url);
    const personId = url.searchParams.get('personId');

    if (!personId) {
      return NextResponse.json({ error: 'personId required' }, { status: 400 });
    }

    const cached = await familyDb
      .select()
      .from(historicalContext)
      .where(eq(historicalContext.personId, personId))
      .get();

    if (cached) {
      return NextResponse.json({
        cached: true,
        events: JSON.parse(cached.events),
      });
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
    const { personId } = body;

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

    // Build prompt
    const prompt = buildHistoricalContextPrompt({
      name: `${primaryName.givenName} ${primaryName.surname}`,
      birthYear: birthEvent?.dateSort ? new Date(birthEvent.dateSort).getFullYear() : undefined,
      birthPlace: birthEvent?.placeText ?? undefined,
      deathYear: deathEvent?.dateSort ? new Date(deathEvent.dateSort).getFullYear() : undefined,
      deathPlace: deathEvent?.placeText ?? undefined,
      events: personEvents
        .filter(e => e.eventType !== 'birth' && e.eventType !== 'death')
        .map(e => ({
          type: e.eventType,
          year: e.dateSort ? new Date(e.dateSort).getFullYear() : undefined,
          place: e.placeText ?? undefined,
        })),
    });

    const model = getModel('extraction'); // Haiku for cost-efficient structured output
    const modelName = 'claude-haiku-4-5';
    const userId = ctx.userId;

    const { text, usage } = await generateText({
      model,
      prompt,
    });

    // Parse the JSON array from the response
    let contextEvents: Array<{ year: number; title: string; description: string; relevance: string }>;
    try {
      // Extract JSON array from response (handle markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      contextEvents = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('Failed to parse historical context response:', parseErr);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 502 }
      );
    }

    // Calculate cost
    const costUsd = calculateCost(modelName, usage.inputTokens ?? 0, usage.outputTokens ?? 0);

    // Cache in historicalContext table (INSERT OR REPLACE via unique constraint on personId)
    await familyDb
      .insert(historicalContext)
      .values({
        personId,
        events: JSON.stringify(contextEvents),
        model: modelName,
        costUsd,
      })
      .onConflictDoUpdate({
        target: [historicalContext.personId],
        set: {
          events: JSON.stringify(contextEvents),
          model: modelName,
          costUsd,
          createdAt: new Date().toISOString(),
        },
      })
      .run();

    // Record usage
    await recordUsage(familyDb, {
      userId,
      model: modelName,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      taskType: 'historical_context',
    });

    return NextResponse.json({ events: contextEvents });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[ai/historical-context POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
