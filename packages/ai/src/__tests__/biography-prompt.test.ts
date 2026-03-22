import { describe, it, expect } from 'vitest';
import { buildBiographyPrompt, type PersonBioData, type BiographyOptions } from '../prompts/biography-prompt';

const basePerson: PersonBioData = {
  name: 'John Smith',
  birthDate: '15 Mar 1850',
  birthPlace: 'Springfield, IL',
  deathDate: '22 Nov 1920',
  deathPlace: 'Chicago, IL',
  sex: 'Male',
  events: [
    { type: 'immigration', date: '1870', place: 'New York, NY', description: 'Arrived from England' },
    { type: 'occupation', date: '1880', description: 'Blacksmith' },
  ],
  parents: [
    { name: 'William Smith', birthYear: 1820 },
    { name: 'Mary Jones', birthYear: 1825 },
  ],
  spouses: [{ name: 'Jane Doe', marriageDate: '1875' }],
  children: [
    { name: 'Robert Smith', birthYear: 1876 },
    { name: 'Alice Smith', birthYear: 1880 },
  ],
  sources: [
    { title: '1880 US Census', citationText: 'Springfield, IL, page 42' },
    { title: 'Immigration Records' },
  ],
};

const baseOptions: BiographyOptions = {
  tone: 'formal',
  length: 'standard',
  focus: 'life_overview',
};

describe('buildBiographyPrompt', () => {
  it('returns a string containing the person name', () => {
    const result = buildBiographyPrompt(basePerson, baseOptions);
    expect(result).toContain('John Smith');
  });

  it('includes tone instructions based on option', () => {
    const formal = buildBiographyPrompt(basePerson, { ...baseOptions, tone: 'formal' });
    expect(formal).toContain('formal');
    expect(formal).toContain('academic');

    const conversational = buildBiographyPrompt(basePerson, { ...baseOptions, tone: 'conversational' });
    expect(conversational).toContain('conversational');

    const storytelling = buildBiographyPrompt(basePerson, { ...baseOptions, tone: 'storytelling' });
    expect(storytelling).toContain('narrative');
  });

  it('includes length instructions based on option', () => {
    const brief = buildBiographyPrompt(basePerson, { ...baseOptions, length: 'brief' });
    expect(brief).toContain('100-200 words');

    const standard = buildBiographyPrompt(basePerson, { ...baseOptions, length: 'standard' });
    expect(standard).toContain('300-500 word');

    const detailed = buildBiographyPrompt(basePerson, { ...baseOptions, length: 'detailed' });
    expect(detailed).toContain('600-1000 word');
  });

  it('includes focus instructions based on option', () => {
    const overview = buildBiographyPrompt(basePerson, { ...baseOptions, focus: 'life_overview' });
    expect(overview).toContain('full arc');

    const immigration = buildBiographyPrompt(basePerson, { ...baseOptions, focus: 'immigration' });
    expect(immigration).toContain('immigration journey');

    const military = buildBiographyPrompt(basePerson, { ...baseOptions, focus: 'military' });
    expect(military).toContain('military service');

    const family = buildBiographyPrompt(basePerson, { ...baseOptions, focus: 'family_life' });
    expect(family).toContain('family relationships');

    const career = buildBiographyPrompt(basePerson, { ...baseOptions, focus: 'career' });
    expect(career).toContain('career');
  });

  it('includes source citations when provided', () => {
    const result = buildBiographyPrompt(basePerson, baseOptions);
    expect(result).toContain('1880 US Census');
    expect(result).toContain('Springfield, IL, page 42');
    expect(result).toContain('Immigration Records');
  });

  it('includes family members', () => {
    const result = buildBiographyPrompt(basePerson, baseOptions);
    expect(result).toContain('William Smith');
    expect(result).toContain('Mary Jones');
    expect(result).toContain('Jane Doe');
    expect(result).toContain('Robert Smith');
    expect(result).toContain('Alice Smith');
  });

  it('contains instruction about distinguishing sourced facts from inferences', () => {
    const result = buildBiographyPrompt(basePerson, baseOptions);
    expect(result).toContain('sourced facts');
    expect(result).toContain('inferences');
    expect(result).toContain('Never fabricate');
  });

  it('handles person with minimal data', () => {
    const minimal: PersonBioData = {
      name: 'Unknown Person',
      sex: 'Unknown',
      events: [],
      parents: [],
      spouses: [],
      children: [],
      sources: [],
    };
    const result = buildBiographyPrompt(minimal, baseOptions);
    expect(result).toContain('Unknown Person');
    expect(result).not.toContain('## Life Events');
    expect(result).not.toContain('## Parents');
    expect(result).not.toContain('## Spouses');
    expect(result).not.toContain('## Children');
    expect(result).not.toContain('## Available Sources');
  });
});
