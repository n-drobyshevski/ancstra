import { describe, it, expect } from 'vitest';
import {
  createPersonSchema,
  signUpSchema,
  updatePersonSchema,
  createFamilySchema,
  createEventSchema,
  createSourceSchema,
  createCitationSchema,
  createLayoutSchema,
} from '../lib/validation';

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

describe('signUpSchema', () => {
  it('accepts valid sign-up input', () => {
    const result = signUpSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      password: 'securepass',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = signUpSchema.safeParse({
      name: 'Test',
      email: 'not-an-email',
      password: 'securepass',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = signUpSchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('updatePersonSchema', () => {
  it('accepts partial update', () => {
    expect(updatePersonSchema.safeParse({ givenName: 'Jane' }).success).toBe(true);
  });
  it('rejects empty object', () => {
    expect(updatePersonSchema.safeParse({}).success).toBe(false);
  });
});

describe('createFamilySchema', () => {
  it('accepts two partners', () => {
    expect(createFamilySchema.safeParse({ partner1Id: 'a', partner2Id: 'b' }).success).toBe(true);
  });
  it('accepts single partner', () => {
    expect(createFamilySchema.safeParse({ partner1Id: 'a' }).success).toBe(true);
  });
  it('rejects no partners', () => {
    expect(createFamilySchema.safeParse({}).success).toBe(false);
  });
});

describe('createEventSchema', () => {
  it('accepts valid event with personId', () => {
    expect(createEventSchema.safeParse({ eventType: 'residence', personId: 'a' }).success).toBe(true);
  });
  it('rejects missing eventType', () => {
    expect(createEventSchema.safeParse({ personId: 'a' }).success).toBe(false);
  });
  it('rejects missing personId and familyId', () => {
    expect(createEventSchema.safeParse({ eventType: 'birth' }).success).toBe(false);
  });
});

describe('createSourceSchema', () => {
  it('accepts valid source', () => {
    expect(createSourceSchema.safeParse({ title: 'Census 1880' }).success).toBe(true);
  });
  it('rejects missing title', () => {
    expect(createSourceSchema.safeParse({}).success).toBe(false);
  });
  it('accepts source with all fields', () => {
    expect(createSourceSchema.safeParse({
      title: 'Census', author: 'US Gov', sourceType: 'census',
    }).success).toBe(true);
  });
});

describe('createCitationSchema', () => {
  it('accepts citation with personId', () => {
    expect(createCitationSchema.safeParse({ sourceId: 's1', personId: 'p1' }).success).toBe(true);
  });
  it('rejects missing sourceId', () => {
    expect(createCitationSchema.safeParse({ personId: 'p1' }).success).toBe(false);
  });
  it('rejects missing entity link', () => {
    expect(createCitationSchema.safeParse({ sourceId: 's1' }).success).toBe(false);
  });
});

describe('createLayoutSchema', () => {
  it('accepts valid layout', () => {
    expect(createLayoutSchema.safeParse({ name: 'My Layout', layoutData: '{}' }).success).toBe(true);
  });
  it('rejects missing name', () => {
    expect(createLayoutSchema.safeParse({ layoutData: '{}' }).success).toBe(false);
  });
  it('rejects missing layoutData', () => {
    expect(createLayoutSchema.safeParse({ name: 'Test' }).success).toBe(false);
  });
});
