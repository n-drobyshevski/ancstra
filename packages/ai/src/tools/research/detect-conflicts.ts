import { tool } from 'ai';
import { z } from 'zod/v3';
import { detectConflicts as detectConflictsQuery } from '@ancstra/research';
import type { Database } from '@ancstra/db';

interface ConflictResult {
  factType: string;
  values: Array<{
    value: string;
    confidence: string;
    factId: string;
  }>;
  suggestion: string;
}

/**
 * Execute conflict detection for a person.
 * Wraps the @ancstra/research detectConflicts query and reshapes output.
 */
export async function executeDetectConflicts(
  db: Database,
  personId: string
): Promise<ConflictResult[]> {
  const rawConflicts = await detectConflictsQuery(db, personId);

  // Group conflicts by factType
  const grouped = new Map<string, ConflictResult>();

  for (const conflict of rawConflicts) {
    const existing = grouped.get(conflict.factType);
    if (existing) {
      // Add values if not already present
      const ids = existing.values.map(v => v.factId);
      if (!ids.includes(conflict.factAId)) {
        existing.values.push({
          value: conflict.valueA,
          confidence: conflict.confidenceA,
          factId: conflict.factAId,
        });
      }
      if (!ids.includes(conflict.factBId)) {
        existing.values.push({
          value: conflict.valueB,
          confidence: conflict.confidenceB,
          factId: conflict.factBId,
        });
      }
    } else {
      grouped.set(conflict.factType, {
        factType: conflict.factType,
        values: [
          { value: conflict.valueA, confidence: conflict.confidenceA, factId: conflict.factAId },
          { value: conflict.valueB, confidence: conflict.confidenceB, factId: conflict.factBId },
        ],
        suggestion: getSuggestion(conflict.factType),
      });
    }
  }

  return [...grouped.values()];
}

function getSuggestion(factType: string): string {
  const suggestions: Record<string, string> = {
    birth_date: 'Compare original source documents to determine the correct birth date. Census records may have approximate ages.',
    birth_place: 'Check if place names changed over time or if different sources use different levels of specificity.',
    death_date: 'Verify against death certificate or burial records for the authoritative date.',
    death_place: 'Cross-reference with burial records and obituaries.',
    name: 'Name variations may reflect different spellings, translations, or married/maiden names.',
    marriage_date: 'Compare church records, civil records, and newspaper announcements.',
    marriage_place: 'Check both civil and religious ceremony locations.',
    parent_name: 'Cross-reference birth certificates, baptismal records, and census data.',
    spouse_name: 'Check marriage records and census entries across years.',
  };

  return suggestions[factType] ?? 'Review the original sources to determine which value is most reliable.';
}

/**
 * Create the detectConflicts tool bound to a database instance.
 */
export function createDetectConflictsTool(db: Database) {
  return tool({
    description: 'Detect conflicting facts for a person in the research workspace (e.g., different birth dates from different sources)',
    inputSchema: z.object({
      personId: z.string().describe('The person ID to check for conflicting facts'),
    }),
    execute: async ({ personId }) => executeDetectConflicts(db, personId),
  });
}
