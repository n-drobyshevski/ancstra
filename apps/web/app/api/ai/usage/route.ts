import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { checkBudget, getUsageStats } from '@ancstra/ai';

export async function GET() {
  try {
    const { ctx, familyDb } = await withAuth('tree:view');

    const monthlyLimit = parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? '10');

    const [budget, stats] = await Promise.all([
      checkBudget(familyDb, monthlyLimit),
      getUsageStats(familyDb, ctx.userId),
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
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[ai/usage GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
