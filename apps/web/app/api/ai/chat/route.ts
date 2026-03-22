import { streamText } from 'ai';
import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  ProviderRegistry,
  NARAProvider,
  ChroniclingAmericaProvider,
} from '@ancstra/research';
import {
  buildTreeContext,
  buildSystemPrompt,
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
    const { ctx, familyDb } = await withAuth('ai:research');

    const { messages, focusPersonId } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      );
    }

    // Check budget before proceeding
    const monthlyLimit = parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? '10');
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
    const systemPrompt = buildSystemPrompt(treeContext);

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
      proposeRelationship: createProposeRelationshipTool(familyDb),
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
      tools,
      maxSteps: 5,
      onFinish: async ({ usage }) => {
        // Record usage after stream completes
        try {
          await recordUsage(familyDb, {
            userId,
            model: 'claude-sonnet-4-5',
            inputTokens: usage.promptTokens,
            outputTokens: usage.completionTokens,
            taskType: 'chat',
          });
        } catch (err) {
          console.error('Failed to record AI usage:', err);
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[ai/chat POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
