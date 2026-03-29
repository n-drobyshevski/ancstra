import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { matchCandidates } from '@ancstra/db';
import { eq, and, sql } from 'drizzle-orm';
import { detectConflicts } from '@ancstra/research';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research', request);

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('personId');

    if (!personId) {
      return NextResponse.json(
        { error: 'personId query parameter is required' },
        { status: 400 },
      );
    }

    // Run all three counts in parallel
    const [conflicts, hintRows, factsheetCountRows] = await Promise.all([
      detectConflicts(familyDb, personId),
      familyDb
        .select({ count: sql<number>`count(*)` })
        .from(matchCandidates)
        .where(
          and(
            eq(matchCandidates.personId, personId),
            eq(matchCandidates.matchStatus, 'pending'),
          ),
        )
        .all(),
      // Factsheets linked to this person via research_facts join
      familyDb.all<{ count: number }>(sql`
        SELECT COUNT(DISTINCT f.id) as count
        FROM factsheets f
        JOIN research_facts rf ON rf.factsheet_id = f.id
        WHERE rf.person_id = ${personId}
          AND f.status != 'dismissed'
      `),
    ]);

    return NextResponse.json({
      conflictCount: conflicts.length,
      hintCount: hintRows[0]?.count ?? 0,
      factsheetCount: factsheetCountRows[0]?.count ?? 0,
    });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/badge-counts GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
