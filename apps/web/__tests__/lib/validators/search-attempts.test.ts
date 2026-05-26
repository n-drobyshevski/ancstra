import { describe, it, expect } from 'vitest';
import {
  CreateSearchAttemptSchema,
  PatchSearchAttemptSchema,
  ListSearchAttemptsQuerySchema,
  NotesRequiredError,
  assertNotesRule,
} from '@/lib/validators/search-attempts';

describe('CreateSearchAttemptSchema', () => {
  const valid = {
    providerKind: 'familysearch' as const,
    searchedAt: '2026-05-26T10:00:00Z',
    outcome: 'found' as const,
  };

  it('accepts a minimal `found` attempt', () => {
    const result = CreateSearchAttemptSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('coerces searchedAt string → Date', () => {
    const result = CreateSearchAttemptSchema.parse(valid);
    expect(result.searchedAt).toBeInstanceOf(Date);
  });

  it('rejects unknown providerKind', () => {
    const result = CreateSearchAttemptSchema.safeParse({
      ...valid, providerKind: 'banana',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown outcome', () => {
    const result = CreateSearchAttemptSchema.safeParse({
      ...valid, outcome: 'mostly-found',
    });
    expect(result.success).toBe(false);
  });

  it('requires notes when outcome=negative', () => {
    const result = CreateSearchAttemptSchema.safeParse({
      ...valid, outcome: 'negative',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'notes');
      expect(issue?.message).toMatch(/required/i);
    }
  });

  it('requires notes when outcome=inconclusive', () => {
    const result = CreateSearchAttemptSchema.safeParse({
      ...valid, outcome: 'inconclusive', notes: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('accepts negative with non-empty notes', () => {
    const result = CreateSearchAttemptSchema.safeParse({
      ...valid, outcome: 'negative',
      notes: 'Tried 3 spelling variants, no record.',
    });
    expect(result.success).toBe(true);
  });

  it('does NOT require notes for `found`', () => {
    const result = CreateSearchAttemptSchema.safeParse({
      ...valid, outcome: 'found', notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional threadId / researchItemId / providerLabel / query', () => {
    const result = CreateSearchAttemptSchema.safeParse({
      ...valid,
      threadId: '11111111-1111-1111-8111-111111111111',
      researchItemId: '22222222-2222-2222-8222-222222222222',
      providerLabel: 'Russian State Archive',
      query: 'Anna Petrova 1923',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID threadId', () => {
    const result = CreateSearchAttemptSchema.safeParse({
      ...valid, threadId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects query longer than 1000 chars', () => {
    const result = CreateSearchAttemptSchema.safeParse({
      ...valid, query: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects notes longer than 2000 chars', () => {
    const result = CreateSearchAttemptSchema.safeParse({
      ...valid, outcome: 'negative', notes: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('PatchSearchAttemptSchema', () => {
  it('accepts an empty object (no-op patch)', () => {
    expect(PatchSearchAttemptSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a single-field patch', () => {
    expect(PatchSearchAttemptSchema.safeParse({ query: 'new query' }).success).toBe(true);
  });

  it('rejects unknown providerKind in patch', () => {
    expect(PatchSearchAttemptSchema.safeParse({ providerKind: 'banana' }).success).toBe(false);
  });

  it('does NOT enforce notes-required at zod layer (route does merged-row check)', () => {
    // Spec §3.3: PATCH can change outcome OR notes but not both atomically;
    // the route fetches existing row, merges, then calls assertNotesRule.
    const result = PatchSearchAttemptSchema.safeParse({ outcome: 'negative' });
    expect(result.success).toBe(true);
  });

  it('coerces searchedAt patch value to Date', () => {
    const result = PatchSearchAttemptSchema.parse({ searchedAt: '2026-05-26T10:00:00Z' });
    expect(result.searchedAt).toBeInstanceOf(Date);
  });
});

describe('ListSearchAttemptsQuerySchema', () => {
  it('parses an empty query into defaults', () => {
    const result = ListSearchAttemptsQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.cursor).toBeUndefined();
  });

  it('coerces limit string → number', () => {
    const result = ListSearchAttemptsQuerySchema.parse({ limit: '25' });
    expect(result.limit).toBe(25);
  });

  it('clamps limit to 1..100 range', () => {
    expect(ListSearchAttemptsQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(ListSearchAttemptsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('accepts outcome / providerKind / threadId filters', () => {
    const result = ListSearchAttemptsQuerySchema.parse({
      outcome: 'negative',
      providerKind: 'ancestry',
      threadId: '11111111-1111-1111-8111-111111111111',
    });
    expect(result.outcome).toBe('negative');
    expect(result.providerKind).toBe('ancestry');
  });

  it('rejects unknown outcome filter', () => {
    expect(ListSearchAttemptsQuerySchema.safeParse({ outcome: 'banana' }).success).toBe(false);
  });
});

describe('assertNotesRule helper', () => {
  it('throws NotesRequiredError when outcome=negative + notes empty', () => {
    expect(() => assertNotesRule({ outcome: 'negative', notes: null }))
      .toThrow(NotesRequiredError);
    expect(() => assertNotesRule({ outcome: 'negative', notes: '' }))
      .toThrow(NotesRequiredError);
    expect(() => assertNotesRule({ outcome: 'negative', notes: '   ' }))
      .toThrow(NotesRequiredError);
  });

  it('throws NotesRequiredError when outcome=inconclusive + notes empty', () => {
    expect(() => assertNotesRule({ outcome: 'inconclusive', notes: null }))
      .toThrow(NotesRequiredError);
  });

  it('does not throw when outcome=found + notes empty', () => {
    expect(() => assertNotesRule({ outcome: 'found', notes: null }))
      .not.toThrow();
  });

  it('does not throw when outcome=negative + notes non-empty', () => {
    expect(() => assertNotesRule({ outcome: 'negative', notes: 'searched, nothing' }))
      .not.toThrow();
  });

  it('NotesRequiredError carries kind/message for HTTP serialization', () => {
    try {
      assertNotesRule({ outcome: 'negative', notes: null });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NotesRequiredError);
      const e = err as NotesRequiredError;
      expect(e.kind).toBe('NOTES_REQUIRED');
      expect(e.message).toMatch(/notes/i);
    }
  });
});
