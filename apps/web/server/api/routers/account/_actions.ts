'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { signIn } from '@/auth';
import { accountRouter } from '../account';
import { createCallerFactory } from '../../trpc';
import { createTRPCContext } from '../../init';
import { signUpSchema } from '@/lib/validation';
import { safeCallbackPath } from '@/lib/auth/safe-callback-url';

export type SignUpState = {
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
  message?: string;
} | undefined;

const createCaller = createCallerFactory(accountRouter);

export async function signUpAction(
  _state: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const ctx = await createTRPCContext({ headers: await headers() });
  const caller = createCaller(ctx);
  try {
    await caller.signUp(parsed.data);
  } catch (e) {
    return { errors: { email: [(e as Error).message] } };
  }

  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });

  const target = safeCallbackPath(formData.get('callbackUrl') as string | null) ?? '/create-family';
  redirect(target);
}
