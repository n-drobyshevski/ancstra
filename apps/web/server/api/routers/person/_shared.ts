import { z } from 'zod/v3';
import { createPersonSchema } from '@/lib/validation';

/** Cache tags invalidated after any person mutation. */
export const PERSON_MUTATION_TAGS = ['persons', 'tree-data', 'dashboard'] as const;

/**
 * Base person schema extended with relation-context fields used by
 * both the tRPC `createRelated` procedure and the `createRelatedPerson`
 * form action.
 */
export const createRelatedPersonSchema = createPersonSchema.extend({
  relation: z.string().nullable().optional(),
  ofPersonId: z.string().nullable().optional(),
});
