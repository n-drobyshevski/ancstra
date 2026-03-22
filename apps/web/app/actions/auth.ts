'use server';

import { createCentralDb, centralSchema } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { signUpSchema } from '@/lib/validation';
import { signIn } from '@/auth';
import { redirect } from 'next/navigation';

export type SignUpState = {
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
  message?: string;
} | undefined;

export async function signUp(
  state: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const validated = signUpSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, email, password } = validated.data;
  const centralDb = createCentralDb();

  // Check if user already exists
  const [existing] = await centralDb
    .select()
    .from(centralSchema.users)
    .where(eq(centralSchema.users.email, email))
    .all();

  if (existing) {
    return { errors: { email: ['An account with this email already exists'] } };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await centralDb.insert(centralSchema.users)
    .values({ name, email, passwordHash })
    .run();

  // Sign in the new user automatically
  await signIn('credentials', {
    email,
    password,
    redirect: false,
  });

  redirect('/create-family');
}
