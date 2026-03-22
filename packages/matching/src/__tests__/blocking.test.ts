import { describe, it, expect } from 'vitest';
import { generateBlockingKey, findCandidateBlocks } from '../scoring/blocking';

describe('generateBlockingKey', () => {
  it('generates key from surname + birth decade', () => {
    expect(generateBlockingKey('Smith', 18501215)).toBe('smith_185');
  });

  it('normalizes surname to lowercase', () => {
    expect(generateBlockingKey('SMITH', 18500101)).toBe('smith_185');
  });

  it('handles missing birth date', () => {
    expect(generateBlockingKey('Smith', null)).toBe('smith_???');
  });

  it('handles compound surnames', () => {
    expect(generateBlockingKey('Van Der Berg', 19200101)).toBe('vanderberg_192');
  });

  it('strips diacritics', () => {
    expect(generateBlockingKey('Muller', 18700101)).toBe('muller_187');
    expect(generateBlockingKey('Mueller', 18700101)).toBe('mueller_187');
  });
});

describe('findCandidateBlocks', () => {
  it('returns adjacent decades as candidate blocks', () => {
    const blocks = findCandidateBlocks('Smith', 18501215);
    expect(blocks).toContain('smith_185');
    expect(blocks).toContain('smith_184'); // decade before
    expect(blocks).toContain('smith_186'); // decade after
    expect(blocks).toHaveLength(3);
  });

  it('returns single block when birth date is null', () => {
    const blocks = findCandidateBlocks('Smith', null);
    expect(blocks).toEqual(['smith_???']);
  });
});
