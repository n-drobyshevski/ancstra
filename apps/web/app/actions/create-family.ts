'use server';

import { auth } from '@/auth';
import { createFamily } from '@ancstra/auth';
import { createCentralDb } from '@ancstra/db';
import { redirect } from 'next/navigation';

export type CreateFamilyState = {
  error?: string;
} | undefined;

export async function createFamilyAction(
  _state: CreateFamilyState,
  formData: FormData,
): Promise<CreateFamilyState> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }

  const name = formData.get('name') as string;
  if (!name || name.trim().length === 0) {
    return { error: 'Family name is required' };
  }

  const centralDb = createCentralDb();
  const { familyId } = await createFamily(centralDb, {
    name: name.trim(),
    ownerId: session.user.id,
  });

  redirect(`/dashboard?family=${familyId}`);
}
