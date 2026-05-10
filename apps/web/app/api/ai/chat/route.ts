import { streamText, stepCountIs, type ToolSet } from 'ai';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withAuthAndExperimental, handleAuthError } from '@/lib/auth/api-guard';
import { createCentralDb, centralSchema } from '@ancstra/db';
import {
  ProviderRegistry,
  NARAProvider,
  ChroniclingAmericaProvider,
  getThread,
  getThreadTimeline,
} from '@ancstra/research';
import {
  buildTreeContext,
  buildSystemPrompt,
  type ActiveThreadContext,
  getModel,
  checkBudget,
  recordUsage,
  // Core tools
  createSearchLocalTreeTool,
  createComputeRelationshipTool,
  createAnalyzeTreeGapsTool,
  explainRecordTool,
  createProposeRelationshipTool,
  createSearchFamilySearchTool,
  // Research tools
  createSearchWebTool,
  createScrapeUrlTool,
  createGetResearchItemsTool,
  createExtractFactsTool,
  createDetectConflictsTool,
  createSuggestSearchesTool,
} from '@ancstra/ai';

export async function POST(request: Request) {
  try {
    const { ctx, familyDb } = await withAuthAndExperimental('ai:research', 'researchChat', request);

    const { messages, focusPersonId, threadId } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      );
    }

    // Read budget limit from central DB family_registry, fall back to env var
    let monthlyLimit = parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? '10');
    try {
      const centralDb = createCentralDb();
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

    // Check budget before proceeding
    const budget = await checkBudget(familyDb, monthlyLimit);

    if (budget.overBudget) {
      return NextResponse.json(
        {
          error: 'Monthly AI budget exceeded',
          spent: budget.spent,
          limit: monthlyLimit,
        },
        { status: 429 }
      );
    }

    // Build tree context for system prompt
    const treeContext = await buildTreeContext(familyDb, focusPersonId);

    // Load active thread context (last 10 events) so the AI knows which thread
    // it is operating in. Limit to 10 events to keep token usage bounded.
    let activeThread: ActiveThreadContext | null = null;
    if (typeof threadId === 'string') {
      const t = await getThread(familyDb, threadId);
      if (t) {
        const events = await getThreadTimeline(familyDb, threadId, { limit: 10 });
        activeThread = {
          id: t.id,
          title: t.title,
          status: t.status,
          summary: t.summary ?? null,
          recentEvents: events.map(e => ({
            eventType: e.eventType,
            reason: e.reason ?? null,
            occurredAt: e.occurredAt,
          })),
        };
      }
    }

    const systemPrompt = buildSystemPrompt(treeContext, activeThread);

    // Build provider registry for web search tools
    const registry = new ProviderRegistry();
    registry.register(new NARAProvider());
    registry.register(new ChroniclingAmericaProvider());

    // Assemble all tools
    const tools = {
      searchLocalTree: createSearchLocalTreeTool(familyDb),
      computeRelationship: createComputeRelationshipTool(familyDb),
      analyzeTreeGaps: createAnalyzeTreeGapsTool(familyDb),
      explainRecord: explainRecordTool,
      proposeRelationship: createProposeRelationshipTool(familyDb, {
        threadId: typeof threadId === 'string' ? threadId : null,
        actorId: ctx.userId,
      }),
      searchFamilySearch: createSearchFamilySearchTool(),
      searchWeb: createSearchWebTool(registry),
      scrapeUrl: createScrapeUrlTool({
        workerBaseUrl: process.env.WORKER_URL,
      }),
      getResearchItems: createGetResearchItemsTool(familyDb),
      extractFacts: createExtractFactsTool(),
      detectConflicts: createDetectConflictsTool(familyDb),
      suggestSearches: createSuggestSearchesTool(familyDb),
    };

    const model = getModel('chat');
    const userId = ctx.userId;

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools: tools as unknown as ToolSet,
      stopWhen: stepCountIs(5),

      onFinish: async ({ usage }) => {
        // Record usage after stream completes
        try {
          await recordUsage(familyDb, {
            userId,
            model: 'claude-sonnet-4-5',
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            taskType: 'chat',
          });
        } catch (err) {
          console.error('Failed to record AI usage:', err);
        }
      }
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[ai/chat POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
