import { describe, it, expect } from 'vitest';
import { requireReason, ReasonRequiredError } from '../../audit/reason';

describe('requireReason (Bundle B §6.1)', () => {
  it('returns the trimmed reason when valid', () => {
    expect(requireReason({ reason: 'because' }, 'unmerge')).toBe('because');
    expect(requireReason({ reason: '  trimmed  ' }, 'unmerge')).toBe('trimmed');
    expect(requireReason({ reason: 'x' }, 'unmerge')).toBe('x'); // 1 char OK
  });

  it('throws when body is missing', () => {
    expect(() => requireReason(undefined, 'unmerge')).toThrow(ReasonRequiredError);
    expect(() => requireReason(null, 'unmerge')).toThrow(/body is required/);
  });

  it('throws when body is not an object', () => {
    expect(() => requireReason('string', 'unmerge')).toThrow(/body is required/);
    expect(() => requireReason(42, 'unmerge')).toThrow(/body is required/);
  });

  it('throws when reason is missing', () => {
    expect(() => requireReason({}, 'unmerge')).toThrow(/must be a string/);
  });

  it('throws when reason is not a string', () => {
    expect(() => requireReason({ reason: 42 }, 'unmerge')).toThrow(/must be a string/);
    expect(() => requireReason({ reason: null }, 'unmerge')).toThrow(/must be a string/);
  });

  it('throws when reason is empty or whitespace', () => {
    expect(() => requireReason({ reason: '' }, 'unmerge')).toThrow(/non-empty/);
    expect(() => requireReason({ reason: '   ' }, 'unmerge')).toThrow(/non-empty/);
    expect(() => requireReason({ reason: '\t\n' }, 'unmerge')).toThrow(/non-empty/);
  });

  it('error carries opName for downstream API formatting', () => {
    try {
      requireReason({ reason: '' }, 'dispute-family');
    } catch (err) {
      expect(err).toBeInstanceOf(ReasonRequiredError);
      expect((err as ReasonRequiredError).opName).toBe('dispute-family');
      expect((err as Error).message).toContain('dispute-family');
    }
  });
});
