import { describe, it, expect } from 'vitest';
import { createPersonSchema } from '../lib/validation';

describe('createPersonSchema', () => {
  it('accepts valid input', () => {
    const result = createPersonSchema.safeParse({
      givenName: 'John',
      surname: 'Smith',
      sex: 'M',
      isLiving: false,
      birthDate: '15 Mar 1845',
      birthPlace: 'Springfield, IL',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing given name', () => {
    const result = createPersonSchema.safeParse({
      givenName: '',
      surname: 'Smith',
      sex: 'M',
      isLiving: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sex value', () => {
    const result = createPersonSchema.safeParse({
      givenName: 'John',
      surname: 'Smith',
      sex: 'X',
      isLiving: true,
    });
    expect(result.success).toBe(false);
  });

  it('allows optional fields to be omitted', () => {
    const result = createPersonSchema.safeParse({
      givenName: 'Mary',
      surname: 'Johnson',
      sex: 'F',
      isLiving: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.birthDate).toBeUndefined();
      expect(result.data.notes).toBeUndefined();
    }
  });
});
