import { describe, it, expect } from 'vitest';
import { parseExtractedFacts, validateFactType } from '../tools/research/extract-facts';

describe('validateFactType', () => {
  it('accepts valid fact types', () => {
    expect(validateFactType('birth_date')).toBe(true);
    expect(validateFactType('death_place')).toBe(true);
    expect(validateFactType('occupation')).toBe(true);
    expect(validateFactType('military_service')).toBe(true);
    expect(validateFactType('parent_name')).toBe(true);
    expect(validateFactType('other')).toBe(true);
  });

  it('rejects invalid fact types', () => {
    expect(validateFactType('invalid_type')).toBe(false);
    expect(validateFactType('favorite_color')).toBe(false);
    expect(validateFactType('')).toBe(false);
  });
});

describe('parseExtractedFacts', () => {
  it('parses well-formed AI extraction output', () => {
    const aiOutput = [
      { factType: 'birth_date', factValue: '15 Mar 1850', confidence: 'high' },
      { factType: 'birth_place', factValue: 'Springfield, IL', confidence: 'medium' },
    ];
    const facts = parseExtractedFacts(aiOutput, 'person-123', 'ri-456');
    expect(facts).toHaveLength(2);
    expect(facts[0].personId).toBe('person-123');
    expect(facts[0].researchItemId).toBe('ri-456');
    expect(facts[0].extractionMethod).toBe('ai_extracted');
    expect(facts[0].factType).toBe('birth_date');
    expect(facts[0].factValue).toBe('15 Mar 1850');
    expect(facts[0].confidence).toBe('high');
  });

  it('filters out facts with invalid types', () => {
    const aiOutput = [
      { factType: 'birth_date', factValue: '1850', confidence: 'high' },
      { factType: 'favorite_color', factValue: 'blue', confidence: 'low' },
    ];
    const facts = parseExtractedFacts(aiOutput, 'person-123', 'ri-456');
    expect(facts).toHaveLength(1);
    expect(facts[0].factType).toBe('birth_date');
  });

  it('handles empty extraction', () => {
    const facts = parseExtractedFacts([], 'person-123', 'ri-456');
    expect(facts).toHaveLength(0);
  });

  it('normalizes invalid confidence to medium', () => {
    const aiOutput = [
      { factType: 'name', factValue: 'John Smith', confidence: 'very_high' },
    ];
    const facts = parseExtractedFacts(aiOutput, 'p-1', 'ri-1');
    expect(facts[0].confidence).toBe('medium');
  });
});
