import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';
import { MULTI_VALUED_TYPES } from '../facts/conflicts';

export interface FactsheetConflict {
  factType: string;
  facts: Array<{
    id: string;
    factValue: string;
    confidence: string;
    accepted: boolean | null;
    researchItemId: string | null;
  }>;
}

export interface PromotabilityResult {
  promotable: boolean;
  blockers: string[];
  conflicts: FactsheetConflict[];
}

/**
 * Detect conflicts within a factsheet — same fact_type with different values
 * for single-valued types.
 */
export async function detectFactsheetConflicts(
  db: Database,
  factsheetId: string,
): Promise<FactsheetConflict[]> {
  const multiValued = MULTI_VALUED_TYPES as readonly string[];

  // Get all facts grouped by type
  const facts = await db.all<{
    id: string;
    factType: string;
    factValue: string;
    confidence: string;
    accepted: number | null;
    researchItemId: string | null;
  }>(sql`
    SELECT id, fact_type as factType, fact_value as factValue,
           confidence, accepted, research_item_id as researchItemId
    FROM research_facts
    WHERE factsheet_id = ${factsheetId}
    ORDER BY fact_type, fact_value
  `);

  // Group by type
  const byType = new Map<string, typeof facts>();
  for (const fact of facts) {
    if (multiValued.includes(fact.factType)) continue;
    const group = byType.get(fact.factType) ?? [];
    group.push(fact);
    byType.set(fact.factType, group);
  }

  // Find types with multiple distinct values
  const conflicts: FactsheetConflict[] = [];
  for (const [factType, group] of byType) {
    const uniqueValues = new Set(group.map(f => f.factValue));
    if (uniqueValues.size > 1) {
      conflicts.push({
        factType,
        facts: group.map(f => ({
          id: f.id,
          factValue: f.factValue,
          confidence: f.confidence,
          accepted: f.accepted === null ? null : f.accepted === 1,
          researchItemId: f.researchItemId,
        })),
      });
    }
  }

  return conflicts;
}

/**
 * Resolve a conflict by accepting one fact and rejecting others.
 */
export async function resolveFactsheetConflict(
  db: Database,
  acceptedFactId: string,
  rejectedFactIds: string[],
): Promise<void> {
  const now = new Date().toISOString();

  await db.run(sql`
    UPDATE research_facts
    SET accepted = 1, updated_at = ${now}
    WHERE id = ${acceptedFactId}
  `);

  for (const rejectedId of rejectedFactIds) {
    await db.run(sql`
      UPDATE research_facts
      SET accepted = 0, updated_at = ${now}
      WHERE id = ${rejectedId}
    `);
  }
}

/**
 * Check if a factsheet is ready for promotion.
 * All single-valued fact conflicts must be resolved.
 */
export async function isFactsheetPromotable(
  db: Database,
  factsheetId: string,
): Promise<PromotabilityResult> {
  const blockers: string[] = [];

  // Check factsheet exists and is in a promotable state
  const sheets = await db.all<{ status: string }>(sql`
    SELECT status FROM factsheets WHERE id = ${factsheetId}
  `);

  if (!sheets[0]) {
    return { promotable: false, blockers: ['Factsheet not found'], conflicts: [] };
  }

  if (sheets[0].status === 'promoted' || sheets[0].status === 'merged') {
    return { promotable: false, blockers: ['Factsheet already promoted/merged'], conflicts: [] };
  }

  if (sheets[0].status === 'dismissed') {
    return { promotable: false, blockers: ['Factsheet is dismissed'], conflicts: [] };
  }

  // Check for unresolved conflicts
  const conflicts = await detectFactsheetConflicts(db, factsheetId);
  const unresolvedConflicts = conflicts.filter(c =>
    c.facts.some(f => f.accepted === null)
  );

  if (unresolvedConflicts.length > 0) {
    for (const conflict of unresolvedConflicts) {
      blockers.push(`Unresolved conflict for ${conflict.factType}: ${conflict.facts.map(f => f.factValue).join(' vs ')}`);
    }
  }

  // Check factsheet has at least one fact
  const factCount = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM research_facts WHERE factsheet_id = ${factsheetId}
  `);

  if (factCount[0]?.count === 0) {
    blockers.push('Factsheet has no facts');
  }

  return {
    promotable: blockers.length === 0,
    blockers,
    conflicts,
  };
}
