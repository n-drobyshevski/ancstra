'use server';

import { createDb, users } from '@ancstra/db';
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
  const db = createDb();

  // Check if user already exists
  const [existing] = db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .all();

  if (existing) {
    return { errors: { email: ['An account with this email already exists'] } };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  db.insert(users)
    .values({ name, email, passwordHash })
    .run();

  // Sign in the new user automatically
  await signIn('credentials', {
    email,
    password,
    redirect: false,
  });

  redirect('/dashboard');
}
