export interface BiographyOptions {
  tone: 'formal' | 'conversational' | 'storytelling';
  length: 'brief' | 'standard' | 'detailed';
  focus: 'life_overview' | 'immigration' | 'military' | 'family_life' | 'career';
}

export interface PersonBioData {
  name: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  sex: string;
  events: { type: string; date?: string; place?: string; description?: string }[];
  parents: { name: string; birthYear?: number }[];
  spouses: { name: string; marriageDate?: string }[];
  children: { name: string; birthYear?: number }[];
  sources: { title: string; citationText?: string }[];
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  formal: 'Write in a formal, academic style suitable for a published family history.',
  conversational: 'Write in a warm, conversational tone as if telling a family story.',
  storytelling: 'Write in a vivid narrative style that brings the person to life.',
};

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  brief: 'Keep the biography to 100-200 words.',
  standard: 'Write a 300-500 word biography.',
  detailed: 'Write a comprehensive 600-1000 word biography.',
};

const FOCUS_INSTRUCTIONS: Record<string, string> = {
  life_overview: 'Cover the full arc of their life from birth to death.',
  immigration: 'Focus on their immigration journey and adaptation to a new country.',
  military: 'Focus on their military service and its impact on their life.',
  family_life: 'Focus on family relationships, marriages, and children.',
  career: 'Focus on their career, occupations, and professional life.',
};

export function buildBiographyPrompt(person: PersonBioData, options: BiographyOptions): string {
  const sections: string[] = [];

  sections.push(`Write a biography for ${person.name}.`);
  sections.push('');
  sections.push('## Person Details');
  sections.push(`Name: ${person.name}`);
  if (person.birthDate) sections.push(`Born: ${person.birthDate}${person.birthPlace ? ` in ${person.birthPlace}` : ''}`);
  if (person.deathDate) sections.push(`Died: ${person.deathDate}${person.deathPlace ? ` in ${person.deathPlace}` : ''}`);
  sections.push(`Sex: ${person.sex}`);

  if (person.events.length > 0) {
    sections.push('');
    sections.push('## Life Events');
    person.events.forEach(e => {
      sections.push(`- ${e.type}${e.date ? ` (${e.date})` : ''}${e.place ? ` in ${e.place}` : ''}${e.description ? `: ${e.description}` : ''}`);
    });
  }

  if (person.parents.length > 0) {
    sections.push('');
    sections.push('## Parents');
    person.parents.forEach(p => sections.push(`- ${p.name}${p.birthYear ? ` (b. ${p.birthYear})` : ''}`));
  }

  if (person.spouses.length > 0) {
    sections.push('');
    sections.push('## Spouses');
    person.spouses.forEach(s => sections.push(`- ${s.name}${s.marriageDate ? ` (married ${s.marriageDate})` : ''}`));
  }

  if (person.children.length > 0) {
    sections.push('');
    sections.push('## Children');
    person.children.forEach(c => sections.push(`- ${c.name}${c.birthYear ? ` (b. ${c.birthYear})` : ''}`));
  }

  if (person.sources.length > 0) {
    sections.push('');
    sections.push('## Available Sources');
    person.sources.forEach(s => sections.push(`- ${s.title}${s.citationText ? `: ${s.citationText}` : ''}`));
  }

  sections.push('');
  sections.push('## Instructions');
  sections.push(TONE_INSTRUCTIONS[options.tone]);
  sections.push(LENGTH_INSTRUCTIONS[options.length]);
  sections.push(FOCUS_INSTRUCTIONS[options.focus]);
  sections.push('');
  sections.push('IMPORTANT: Distinguish between documented facts and inferences. Use phrases like "Records show..." or "According to the census..." for sourced facts, and "It is likely that..." or "Given the era..." for reasonable inferences. Never fabricate specific details.');

  return sections.join('\n');
}
