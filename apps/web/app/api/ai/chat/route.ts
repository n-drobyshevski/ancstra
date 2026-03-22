import { streamText } from 'ai';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messages, focusPersonId } = await request.json();

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: 'messages array is required' },
      { status: 400 }
    );
  }

  const db = createDb();

  // Check budget before proceeding
  const monthlyLimit = parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? '10');
  const budget = await checkBudget(db, monthlyLimit);

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
  const treeContext = await buildTreeContext(db, focusPersonId);
  const systemPrompt = buildSystemPrompt(treeContext);

  // Build provider registry for web search tools
  const registry = new ProviderRegistry();
  registry.register(new NARAProvider());
  registry.register(new ChroniclingAmericaProvider());

  // Assemble all tools
  const tools = {
    searchLocalTree: createSearchLocalTreeTool(db),
    computeRelationship: createComputeRelationshipTool(db),
    analyzeTreeGaps: createAnalyzeTreeGapsTool(db),
    explainRecord: explainRecordTool,
    proposeRelationship: createProposeRelationshipTool(db),
    searchFamilySearch: createSearchFamilySearchTool(),
    searchWeb: createSearchWebTool(registry),
    scrapeUrl: createScrapeUrlTool({
      workerBaseUrl: process.env.WORKER_URL,
    }),
    getResearchItems: createGetResearchItemsTool(db),
    extractFacts: createExtractFactsTool(),
    detectConflicts: createDetectConflictsTool(db),
    suggestSearches: createSuggestSearchesTool(db),
  };

  const model = getModel('chat');
  const userId = session.user.id;

  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 5,
    onFinish: async ({ usage }) => {
      // Record usage after stream completes
      try {
        await recordUsage(db, {
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
}
