import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';

export interface DuplicateMatch {
  personId: string;
  givenName: string;
  surname: string;
  score: number;
  matchedFields: string[];
}

/**
 * Check for potential duplicate persons in the tree matching a factsheet's facts.
 * Uses simple string matching on name, birth date, and death date.
 * For more sophisticated matching, use packages/matching/ directly.
 */
export async function checkDuplicates(
  db: Database,
  factsheetId: string,
): Promise<DuplicateMatch[]> {
  // Extract key facts from factsheet
  const facts = await db.all<{
    factType: string;
    factValue: string;
    accepted: number | null;
  }>(sql`
    SELECT fact_type as factType, fact_value as factValue, accepted
    FROM research_facts
    WHERE factsheet_id = ${factsheetId}
      AND (accepted IS NULL OR accepted = 1)
    ORDER BY fact_type
  `);

  const factMap = new Map<string, string>();
  for (const f of facts) {
    // Use accepted fact if available, otherwise first occurrence
    if (!factMap.has(f.factType) || f.accepted === 1) {
      factMap.set(f.factType, f.factValue);
    }
  }

  const name = factMap.get('name');
  const birthDate = factMap.get('birth_date');
  const deathDate = factMap.get('death_date');
  const birthPlace = factMap.get('birth_place');

  if (!name && !birthDate) {
    return []; // Not enough info to match
  }

  // Query person_summary for potential matches
  const candidates = await db.all<{
    personId: string;
    givenName: string;
    surname: string;
    birthDate: string | null;
    deathDate: string | null;
    birthPlace: string | null;
  }>(sql`
    SELECT person_id as personId, given_name as givenName, surname,
           birth_date as birthDate, death_date as deathDate, birth_place as birthPlace
    FROM person_summary
  `);

  const matches: DuplicateMatch[] = [];

  for (const candidate of candidates) {
    let score = 0;
    const matchedFields: string[] = [];
    const fullName = `${candidate.givenName} ${candidate.surname}`.toLowerCase().trim();

    // Name matching (simple containment + exact)
    if (name) {
      const normalizedName = name.toLowerCase().trim();
      if (fullName === normalizedName) {
        score += 0.4;
        matchedFields.push('name (exact)');
      } else if (fullName.includes(normalizedName) || normalizedName.includes(fullName)) {
        score += 0.25;
        matchedFields.push('name (partial)');
      }
    }

    // Birth date matching
    if (birthDate && candidate.birthDate) {
      if (candidate.birthDate.includes(birthDate) || birthDate.includes(candidate.birthDate)) {
        score += 0.25;
        matchedFields.push('birth_date');
      }
    }

    // Death date matching
    if (deathDate && candidate.deathDate) {
      if (candidate.deathDate.includes(deathDate) || deathDate.includes(candidate.deathDate)) {
        score += 0.15;
        matchedFields.push('death_date');
      }
    }

    // Birth place matching
    if (birthPlace && candidate.birthPlace) {
      const normalizedPlace = birthPlace.toLowerCase().trim();
      const candidatePlace = candidate.birthPlace.toLowerCase().trim();
      if (candidatePlace.includes(normalizedPlace) || normalizedPlace.includes(candidatePlace)) {
        score += 0.2;
        matchedFields.push('birth_place');
      }
    }

    if (score >= 0.4) {
      matches.push({
        personId: candidate.personId,
        givenName: candidate.givenName,
        surname: candidate.surname,
        score: Math.min(score, 1),
        matchedFields,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 10);
}
