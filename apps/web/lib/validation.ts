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
