'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import {
  acceptInvite,
  logActivity,
  validateInviteToken,
  type ActivityAction,
} from '@ancstra/auth';
import { centralSchema } from '@ancstra/db';
import { signIn } from '@/auth';
import { getCentralDb } from '@/lib/db-singleton';
import { signUpSchema } from '@/lib/validation';
import { authedFormAction } from '../../trpc';
import { invalidateTags } from '../../cache';

export const acceptInviteAction = authedFormAction
  .meta({ span: 'auth.acceptInvite' })
  .input(z.object({ token: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const result = await acceptInvite(ctx.centralDb, input.token, ctx.userId);
    await logActivity(ctx.centralDb, {
      familyId: result.familyId,
      userId: ctx.userId,
      action: 'invite_accepted' as ActivityAction,
      summary: 'Joined the family',
    });
    invalidateTags(['activity']);
    redirect(`/dashboard?family=${result.familyId}&invite=accepted`);
  });

/**
 * Combined signup + invite-accept used by the inline signup form on /join.
 *
 * Returned shape mirrors {@link SignUpState} (errors keyed by field, free-form
 * `message`) so the form can render server-side validation errors without
 * needing a separate flow. On success we redirect — the throw from
 * `redirect()` short-circuits any further client-side handling.
 *
 * Flow:
 *   1. Parse the signup payload (name / email / password).
 *   2. Validate the invite token. If the invite is email-locked we surface a
 *      field-level error so the form can highlight the email input.
 *   3. Insert the user.
 *   4. signIn('credentials') so the user has a session cookie.
 *   5. Accept the invite (creates family_members + bumps memberships_version).
 *   6. signIn AGAIN so the JWT picks up the new membership before the proxy
 *      sees the redirect target — without the second sign-in the JWT still
 *      reports memberships=[] and /dashboard?family=… bounces back to
 *      /create-family.
 *   7. Redirect to /dashboard?family=…&invite=accepted.
 */
export type SignUpAndAcceptState = {
  errors?: { name?: string[]; email?: string[]; password?: string[] };
  message?: string;
} | undefined;

export interface SignUpAndAcceptInput {
  name: string;
  email: string;
  password: string;
  token: string;
}

export async function signUpAndAcceptAction(
  input: SignUpAndAcceptInput,
): Promise<SignUpAndAcceptState> {
  // 1. Validate the signup payload before touching the DB.
  const parsed = signUpSchema.safeParse({
    name: input.name,
    email: input.email,
    password: input.password,
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const centralDb = await getCentralDb();

  // 2. Validate the invite. We always pass the submitted email so an
  //    email-locked invite is enforced even if the user crafts a request
  //    bypassing the form's read-only field.
  const validation = await validateInviteToken(
    centralDb,
    input.token,
    parsed.data.email,
  );
  if (!validation.valid) {
    if (validation.reason === 'Email does not match invitation') {
      return {
        errors: {
          email: ['This invitation is for a different email address.'],
        },
      };
    }
    return { message: validation.reason ?? 'Invitation is not valid.' };
  }

  const invitation = validation.invitation!;

  // 3. Create the user. Re-check for an existing email here as a final
  //    guard — the form-level check ran in the browser and the db is the
  //    source of truth.
  const existing = await centralDb
    .select({ id: centralSchema.users.id })
    .from(centralSchema.users)
    .where(eq(centralSchema.users.email, parsed.data.email))
    .all();
  if (existing.length > 0) {
    return { errors: { email: ['An account with this email already exists.'] } };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const inserted = await centralDb
    .insert(centralSchema.users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
    })
    .returning({ id: centralSchema.users.id })
    .get();

  if (!inserted?.id) {
    return { message: 'Failed to create account. Please try again.' };
  }

  // 4. Sign in so the next step has session context.
  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });

  // 5. Accept the invite.
  await acceptInvite(centralDb, input.token, inserted.id);
  await logActivity(centralDb, {
    familyId: invitation.familyId,
    userId: inserted.id,
    action: 'invite_accepted' as ActivityAction,
    summary: 'Joined the family',
  });
  invalidateTags(['activity']);

  // 6. Re-issue the JWT so it picks up the new membership before the proxy
  //    sees the redirect.
  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });

  // 7. Land in the new family's dashboard.
  redirect(`/dashboard?family=${invitation.familyId}&invite=accepted`);
}
