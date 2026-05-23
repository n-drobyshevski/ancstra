import { describe, it, expect } from 'vitest';
import * as schema from '@ancstra/db';

describe('proposed_relationships removed (Bundle A)', () => {
  it('ai-schema no longer exports proposedRelationships', () => {
    expect((schema as Record<string, unknown>).proposedRelationships).toBeUndefined();
  });
});
