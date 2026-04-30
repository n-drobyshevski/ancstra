'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { familyRouter } from '../family';
import { createCallerFactory } from '../../trpc';
import { createTRPCContext } from '../../init';

export type CreateFamilyState = { error?: string } | undefined;

const createCaller = createCallerFactory(familyRouter);

export async function createFamilyAction(
  _state: CreateFamilyState,
  formData: FormData,
): Promise<CreateFamilyState> {
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  if (!name) return { error: 'Family name is required' };

  const ctx = await createTRPCContext({ headers: await headers() });
  const caller = createCaller(ctx);
  let familyId: string;
  try {
    const result = await caller.create({ name });
    familyId = result.familyId;
  } catch (e) {
    return { error: (e as Error).message };
  }

  redirect(`/dashboard?family=${familyId}`);
}
