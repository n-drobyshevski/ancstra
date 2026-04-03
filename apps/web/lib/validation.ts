import { z } from 'zod';

export const createPersonSchema = z.object({
  givenName: z.string().min(1, 'Given name is required'),
  surname: z.string().min(1, 'Surname is required'),
  sex: z.enum(['M', 'F', 'U']),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  deathDate: z.string().optional(),
  deathPlace: z.string().optional(),
  isLiving: z.boolean(),
  notes: z.string().optional(),
});

export type CreatePersonFormData = z.infer<typeof createPersonSchema>;

export const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const updatePersonSchema = z.object({
  givenName: z.string().min(1).optional(),
  surname: z.string().min(1).optional(),
  sex: z.enum(['M', 'F', 'U']).optional(),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  deathDate: z.string().optional(),
  deathPlace: z.string().optional(),
  isLiving: z.boolean().optional(),
  notes: z.string().optional(),
  version: z.number().int().optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
);

export const createFamilySchema = z.object({
  partner1Id: z.string().optional(),
  partner2Id: z.string().optional(),
  relationshipType: z.enum(['married', 'civil_union', 'domestic_partner', 'unmarried', 'unknown']).optional(),
}).refine(
  (data) => data.partner1Id || data.partner2Id,
  { message: 'At least one partner must be provided' }
);

export const createEventSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  dateOriginal: z.string().optional(),
  dateEndOriginal: z.string().optional(),
  placeText: z.string().optional(),
  description: z.string().optional(),
  dateModifier: z.enum(['exact', 'about', 'estimated', 'before', 'after', 'between', 'calculated', 'interpreted']).optional(),
  personId: z.string().optional(),
  familyId: z.string().optional(),
}).refine(
  (data) => data.personId || data.familyId,
  { message: 'Must have personId or familyId' }
);

export const updateEventSchema = z.object({
  eventType: z.string().min(1).optional(),
  dateOriginal: z.string().optional(),
  dateEndOriginal: z.string().optional(),
  placeText: z.string().optional(),
  description: z.string().optional(),
  dateModifier: z.enum(['exact', 'about', 'estimated', 'before', 'after', 'between', 'calculated', 'interpreted']).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
);

export const updateFamilySchema = z.object({
  relationshipType: z.enum(['married', 'civil_union', 'domestic_partner', 'unmarried', 'unknown']).optional(),
  validationStatus: z.enum(['confirmed', 'proposed', 'disputed']).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
);

export const addChildSchema = z.object({
  personId: z.string().min(1),
  childOrder: z.number().optional(),
  relationshipToParent1: z.enum(['biological', 'adopted', 'foster', 'step', 'unknown']).optional(),
  relationshipToParent2: z.enum(['biological', 'adopted', 'foster', 'step', 'unknown']).optional(),
});

export const createLayoutSchema = z.object({
  name: z.string().min(1, 'Layout name is required'),
  layoutData: z.string().min(2, 'Layout data is required'),
  isDefault: z.boolean().optional(),
});

export const updateLayoutSchema = z.object({
  name: z.string().min(1).optional(),
  layoutData: z.string().min(2).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
);
