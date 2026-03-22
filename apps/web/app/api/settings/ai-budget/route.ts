import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { centralSchema } from '@ancstra/db';
import { checkBudget, getUsageStats } from '@ancstra/ai';

export async function GET() {
  try {
    const { familyDb, centralDb, ctx } = await withAuth('tree:view');

    const family = await centralDb
      .select()
      .from(centralSchema.familyRegistry)
      .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
      .get();

    const limit = family?.monthlyAiBudgetUsd ?? 10;
    const budget = await checkBudget(familyDb, limit);
    const stats = await getUsageStats(familyDb);

    return NextResponse.json({ limit, ...budget, stats });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { centralDb, ctx } = await withAuth('settings:manage');
    const { monthlyBudgetUsd } = await request.json();

    if (typeof monthlyBudgetUsd !== 'number' || monthlyBudgetUsd < 0 || monthlyBudgetUsd > 1000) {
      return NextResponse.json(
        { error: 'Budget must be a number between 0 and 1000' },
        { status: 400 },
      );
    }

    await centralDb
      .update(centralSchema.familyRegistry)
      .set({ monthlyAiBudgetUsd: monthlyBudgetUsd })
      .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
