'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { createFamily } from '@ancstra/auth';
import { createCentralDb } from '@ancstra/db';

export type CreateFamilyState = { error?: string } | undefined;

export async function createFamilyAction(
  _state: CreateFamilyState,
  formData: FormData,
): Promise<CreateFamilyState> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }

  const name = (formData.get('name') as string | null)?.trim() ?? '';
  if (!name) {
    return { error: 'Family name is required' };
  }

  const centralDb = createCentralDb();
  const { familyId } = await createFamily(centralDb, {
    name,
    ownerId: session.user.id,
  });
  // TODO(sub-spec-A): bump users.memberships_version once the column exists

  redirect(`/dashboard?family=${familyId}`);
}
