import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';

/**
 * Per-million-token pricing for Anthropic models (USD).
 * Source: Anthropic pricing page / ai-strategy.md
 */
export const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
};

/**
 * Calculate cost in USD for a given model and token counts.
 * Returns 0 for unknown models.
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

interface UsageRecord {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  taskType: 'chat' | 'extraction' | 'analysis' | 'citation';
  sessionId?: string;
}

/**
 * Record AI usage into the ai_usage table.
 */
export async function recordUsage(db: Database, record: UsageRecord): Promise<void> {
  const costUsd = calculateCost(record.model, record.inputTokens, record.outputTokens);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.run(sql`
    INSERT INTO ai_usage (id, user_id, model, input_tokens, output_tokens, cost_usd, task_type, session_id, created_at)
    VALUES (${id}, ${record.userId}, ${record.model}, ${record.inputTokens}, ${record.outputTokens}, ${costUsd}, ${record.taskType}, ${record.sessionId ?? null}, ${createdAt})
  `);
}

interface BudgetResult {
  spent: number;
  remaining: number;
  overBudget: boolean;
}

/**
 * Check budget for the current calendar month.
 * @param db Database instance
 * @param monthlyLimitUsd Monthly budget limit in USD (default $10)
 */
export async function checkBudget(
  db: Database,
  monthlyLimitUsd = 10
): Promise<BudgetResult> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const rows = db.all<{ total: number | null }>(sql`
    SELECT SUM(cost_usd) as total
    FROM ai_usage
    WHERE created_at >= ${monthStart}
  `);

  const spent = rows[0]?.total ?? 0;
  const overBudget = spent >= monthlyLimitUsd;
  const remaining = overBudget ? 0 : Math.round((monthlyLimitUsd - spent) * 100) / 100;

  return { spent: Math.round(spent * 100) / 100, remaining, overBudget };
}

interface UsageStats {
  totalCost: number;
  totalRequests: number;
  byModel: Record<string, { requests: number; cost: number }>;
}

/**
 * Get usage statistics for the current month.
 */
export async function getUsageStats(
  db: Database,
  _userId?: string,
  _daysBack = 30
): Promise<UsageStats> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const rows = db.all<{ model: string; cnt: number; cost: number }>(sql`
    SELECT model, COUNT(*) as cnt, SUM(cost_usd) as cost
    FROM ai_usage
    WHERE created_at >= ${monthStart}
    GROUP BY model
  `);

  let totalCost = 0;
  let totalRequests = 0;
  const byModel: Record<string, { requests: number; cost: number }> = {};

  for (const row of rows) {
    totalCost += row.cost;
    totalRequests += row.cnt;
    byModel[row.model] = { requests: row.cnt, cost: row.cost };
  }

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalRequests,
    byModel,
  };
}
