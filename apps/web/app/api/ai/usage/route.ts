import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
import { checkBudget, getUsageStats } from '@ancstra/ai';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createDb();
  const monthlyLimit = parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? '10');

  const [budget, stats] = await Promise.all([
    checkBudget(db, monthlyLimit),
    getUsageStats(db, session.user.id),
  ]);

  const percentUsed = monthlyLimit > 0
    ? Math.round((budget.spent / monthlyLimit) * 100)
    : 0;

  return NextResponse.json({
    spent: budget.spent,
    limit: monthlyLimit,
    remaining: budget.remaining,
    percentUsed,
    overBudget: budget.overBudget,
    totalRequests: stats.totalRequests,
    byModel: stats.byModel,
  });
}
