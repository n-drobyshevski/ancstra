import { tool } from 'ai';
import { z } from 'zod/v3';
import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';

interface SearchSuggestion {
  query: string;
  provider: string;
  reasoningText: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Execute search suggestions for a person based on their data gaps.
 */
export async function executeSuggestSearches(
  db: Database,
  personId: string,
  maxSuggestions = 5
): Promise<{ suggestions: SearchSuggestion[] }> {
  const suggestions: SearchSuggestion[] = [];

  // Get person info
  const personRows = await db.all<{
    given_name: string;
    surname: string;
    sex: string;
  }>(sql`
    SELECT pn.given_name, pn.surname, p.sex
    FROM persons p
    JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
    WHERE p.id = ${personId} AND p.deleted_at IS NULL
  `);

  if (personRows.length === 0) {
    return { suggestions: [] };
  }

  const person = personRows[0];
  const fullName = `${person.given_name} ${person.surname}`;

  // Get existing events
  const eventRows = await db.all<{
    event_type: string;
    date_sort: number | null;
    place_text: string | null;
  }>(sql`
    SELECT event_type, date_sort, place_text
    FROM events WHERE person_id = ${personId}
  `);

  const events = new Map<string, { dateSort: number | null; place: string | null }>();
  for (const e of eventRows) {
    events.set(e.event_type, { dateSort: e.date_sort, place: e.place_text });
  }

  const birthEvent = events.get('birth');
  const deathEvent = events.get('death');
  const birthYear = birthEvent?.dateSort ? Math.floor(birthEvent.dateSort / 10000) : null;
  const deathYear = deathEvent?.dateSort ? Math.floor(deathEvent.dateSort / 10000) : null;

  // Check existing research items to avoid suggesting duplicate searches
  const existingQueries = await db.all<{ search_query: string }>(sql`
    SELECT DISTINCT ri.search_query
    FROM research_items ri
    JOIN research_item_persons rip ON rip.research_item_id = ri.id
    WHERE rip.person_id = ${personId} AND ri.search_query IS NOT NULL
  `);
  const searched = new Set(existingQueries.map(q => q.search_query.toLowerCase()));

  // Missing birth records
  if (!birthEvent) {
    const query = `${fullName} birth record`;
    if (!searched.has(query.toLowerCase())) {
      suggestions.push({
        query,
        provider: 'familysearch',
        reasoningText: `No birth date recorded for ${fullName}. Birth or baptismal records could establish this.`,
        priority: 'high',
      });
    }
  }

  // Missing death records
  if (!deathEvent) {
    const query = `${fullName} death record obituary`;
    if (!searched.has(query.toLowerCase())) {
      suggestions.push({
        query,
        provider: 'web_search',
        reasoningText: `No death date recorded for ${fullName}. Search for obituaries or death notices.`,
        priority: 'medium',
      });
    }
  }

  // Census records if US-based and birth year is known
  if (birthYear && (birthEvent?.place?.toLowerCase().includes('us') ||
      birthEvent?.place?.toLowerCase().includes('united states') ||
      birthEvent?.place?.toLowerCase().includes('america'))) {
    // Suggest census years the person would have been alive for
    const censusYears = [1850, 1860, 1870, 1880, 1900, 1910, 1920, 1930, 1940, 1950];
    for (const year of censusYears) {
      if (birthYear && year >= birthYear && (!deathYear || year <= deathYear)) {
        const query = `${fullName} ${year} census`;
        if (!searched.has(query.toLowerCase())) {
          suggestions.push({
            query,
            provider: 'familysearch',
            reasoningText: `${fullName} would have been ${year - birthYear} years old during the ${year} US Census.`,
            priority: 'medium',
          });
          break; // Only suggest one census year to avoid flooding
        }
      }
    }
  }

  // Military records for males born in conflict eras
  if (person.sex === 'M' && birthYear) {
    const wars = [
      { name: 'Civil War', start: 1820, end: 1847 },
      { name: 'WWI', start: 1876, end: 1900 },
      { name: 'WWII', start: 1900, end: 1927 },
    ];
    for (const war of wars) {
      if (birthYear >= war.start && birthYear <= war.end) {
        const query = `${fullName} ${war.name} military record`;
        if (!searched.has(query.toLowerCase())) {
          suggestions.push({
            query,
            provider: 'nara',
            reasoningText: `${fullName} (born ${birthYear}) was of military age during the ${war.name}. Search NARA for service records.`,
            priority: 'medium',
          });
        }
      }
    }
  }

  // Missing parents
  const hasParents = await db.all<{ cnt: number }>(sql`
    SELECT COUNT(*) as cnt FROM children WHERE person_id = ${personId}
  `);
  if ((hasParents[0]?.cnt ?? 0) === 0) {
    const query = `${fullName} parents family`;
    if (!searched.has(query.toLowerCase())) {
      suggestions.push({
        query,
        provider: 'familysearch',
        reasoningText: `No parents recorded for ${fullName}. Search family records to identify parents.`,
        priority: 'high',
      });
    }
  }

  // Newspaper search for general mentions
  const query = `"${person.surname}" "${person.given_name}"`;
  if (!searched.has(query.toLowerCase())) {
    suggestions.push({
      query,
      provider: 'chronicling_america',
      reasoningText: `Search historical newspapers for mentions of ${fullName} — may find obituaries, announcements, or legal notices.`,
      priority: 'low',
    });
  }

  return {
    suggestions: suggestions.slice(0, maxSuggestions),
  };
}

/**
 * Create the suggestSearches tool bound to a database instance.
 */
export function createSuggestSearchesTool(db: Database) {
  return tool({
    description: 'Analyze a person\'s existing data and suggest targeted searches to fill research gaps',
    inputSchema: z.object({
      personId: z.string().describe('The person ID to generate search suggestions for'),
      maxSuggestions: z.number().default(5).describe('Maximum number of suggestions to return'),
    }),
    execute: async ({ personId, maxSuggestions }) =>
      executeSuggestSearches(db, personId, maxSuggestions),
  });
}
