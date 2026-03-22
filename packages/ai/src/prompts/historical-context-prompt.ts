export function buildHistoricalContextPrompt(person: {
  name: string;
  birthYear?: number;
  birthPlace?: string;
  deathYear?: number;
  deathPlace?: string;
  events: { type: string; year?: number; place?: string }[];
}): string {
  return `You are a historical context expert. Given this person's life details, return 5-10 major historical events that would have directly affected their life.

Person: ${person.name}
Born: ${person.birthYear || 'unknown'} in ${person.birthPlace || 'unknown location'}
Died: ${person.deathYear || 'unknown'} in ${person.deathPlace || 'unknown location'}

Key life events:
${person.events.map(e => `- ${e.year || '?'}: ${e.type} in ${e.place || 'unknown'}`).join('\n')}

Return a JSON array of objects with this exact structure:
[{ "year": 1861, "title": "Short Title", "description": "1-2 sentences of context", "relevance": "How this affected the person" }]

Focus on events relevant to their specific time, location, and demographic. Include wars, economic events, migration waves, local history, and social changes. Only include events that occurred during the person's lifetime.`;
}
